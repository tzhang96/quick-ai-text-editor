"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import Placeholder from '@tiptap/extension-placeholder';
import EditorMenuBar from './EditorMenuBar';
import TextSelectionPopup from './TextSelectionPopup';
import EditHistoryViewer from './EditHistoryViewer';
import { AIAction, logEditHistory, initializeGemini, GeminiModel, DEFAULT_MODEL } from '../services/geminiService';
import { Color } from '@tiptap/extension-color';
import { debounce } from 'lodash';

// Type for action history item
interface ActionHistoryItem {
  action: AIAction;
  instructions: string;
  timestamp: number;
  modelName: GeminiModel;
}

// Maximum number of actions to keep in history
const MAX_ACTION_HISTORY = 10;

// Interface for tracking text changes for manual edits
interface TextChangeTracker {
  previousContent: string;
  changeTimer: NodeJS.Timeout | null;
  isTracking: boolean;
  ignoreNextChange: boolean; // Flag to ignore changes immediately following AI action
}

// Define highlight interface
interface Highlight {
  id: string;
  from: number;
  to: number;
}

// Create a custom mark for persistent highlighting
const PersistentHighlight = Extension.create({
  name: 'persistentHighlight',

  addOptions() {
    return {
      highlightClass: 'persistent-highlight',
    };
  },

  addStorage() {
    return {
      highlights: [] as Highlight[],
    };
  },

  addCommands() {
    return {
      addHighlight: ({ from, to }: { from: number; to: number }) => () => {
        const id = Math.random().toString(36).substr(2, 9);
        this.storage.highlights.push({ id, from, to });
        return true;
      },
      removeHighlight: (id: string) => () => {
        this.storage.highlights = this.storage.highlights.filter((h: Highlight) => h.id !== id);
        return true;
      },
      clearHighlights: () => () => {
        this.storage.highlights = [];
        return true;
      },
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    } as Record<string, Function>;
  },

  addProseMirrorPlugins() {
    const highlightClass = this.options.highlightClass;
    const pluginKey = new PluginKey('persistentHighlight');
    
    // Storing a reference to 'this' is required here for ProseMirror plugins
    // The plugin context will be different, so we need this reference to access the extension's storage
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const extension = this;
    
    return [
      new Plugin({
        key: pluginKey,
        state: {
          init() {
            return { highlights: [] as Highlight[] };
          },
          // These parameters are required by the ProseMirror API but not used in our implementation
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          apply(_tr, _value) {
            return { highlights: extension.storage.highlights };
          }
        },
        props: {
          decorations(state) {
            const pluginState = this.getState(state);
            const highlights = pluginState?.highlights || [];
            
            if (highlights.length === 0) return DecorationSet.empty;
            
            const decorations = highlights.map(({ from, to }) => {
              return Decoration.inline(from, to, {
                class: highlightClass,
              });
            });
            
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

const Editor = () => {
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionCoords, setSelectionCoords] = useState<{ x: number, y: number } | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  // const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [actionHistory, setActionHistory] = useState<ActionHistoryItem[]>([]);
  const [selectionRange, setSelectionRange] = useState<{ from: number; to: number } | null>(null);
  const popupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // const editorRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<TiptapEditor | null>(null);
  const persistentHighlightExtension = useRef<typeof PersistentHighlight | null>(null);
  const textChangeTracker = useRef<TextChangeTracker>({
    previousContent: '',
    changeTimer: null,
    isTracking: false,
    ignoreNextChange: false
  });

  // Model selection state with default value
  const [activeModel, setActiveModel] = useState<GeminiModel>(DEFAULT_MODEL);

  // Initialize Gemini when component mounts
  useEffect(() => {
    try {
      initializeGemini();
      console.log('Gemini API initialized');
      
      // Load preferred model from localStorage on init
      const savedModel = localStorage.getItem('preferredModel') as GeminiModel | null;
      if (savedModel && [
        'gemini-2.0-pro-exp-02-05', 
        'gemini-2.0-flash', 
        'gemini-2.0-flash-lite-preview-02-05'
      ].includes(savedModel)) {
        setActiveModel(savedModel);
        console.log('Loaded preferred model:', savedModel);
      }
      
      // Load action history from localStorage
      const storedHistory = localStorage.getItem('actionHistory');
      if (storedHistory) {
        try {
          const parsedHistory = JSON.parse(storedHistory);
          if (Array.isArray(parsedHistory)) {
            setActionHistory(parsedHistory.slice(0, MAX_ACTION_HISTORY));
            console.log('Loaded action history from localStorage');
          }
        } catch (parseError) {
          console.error('Error parsing action history:', parseError);
        }
      }
    } catch (error) {
      console.error('Failed to initialize Gemini API:', error);
    }
  }, []);

  // Ensure we have a reference to the persistentHighlight extension
  persistentHighlightExtension.current = PersistentHighlight;

  // Function to set persistent highlight
  const setPersistentHighlight = (editor: TiptapEditor, range: { from: number; to: number } | null) => {
    const extension = editor.extensionManager.extensions.find(
      ext => ext.name === 'persistentHighlight'
    );
    
    if (extension) {
      extension.storage.highlights = range ? [{ id: Math.random().toString(36).substr(2, 9), from: range.from, to: range.to }] : [];
      editor.view.dispatch(editor.state.tr); // Force redraw
    }
  };

  // Function to clear persistent highlight
  const clearPersistentHighlight = (editor: TiptapEditor) => {
    const extension = editor.extensionManager.extensions.find(
      ext => ext.name === 'persistentHighlight'
    );
    
    if (extension) {
      extension.storage.highlights = [];
      editor.view.dispatch(editor.state.tr); // Force redraw
    }
  };

  // This effect handles the selection and showing the popup
  useEffect(() => {
    const editor = editorInstance.current;
    if (!editor) return;
    
    const handleSelection = () => {
      // Get the current selection
      const selection = window.getSelection();
      
      // Add debug logging for production troubleshooting
      console.log('Selection debug:', { 
        hasSelection: !!selection, 
        selectionText: selection?.toString().trim() || '',
        editorElement: !!editor.view.dom,
        inEditor: selection?.anchorNode ? editor.view.dom.contains(selection.anchorNode) : false
      });
      
      // Check if selection exists, has content, and is within the editor
      if (selection && 
          selection.toString().trim().length > 0 && 
          editor.view.dom.contains(selection.anchorNode)) {
        
        try {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          // Verify we got valid coordinates
          if (rect && rect.width > 0 && rect.height > 0) {
            // Store the current selection text and position
            const selText = selection.toString();
            setSelectedText(selText);
            
            const coords = {
              x: rect.left + window.scrollX,
              y: rect.bottom + window.scrollY
            };
            
            console.log('Valid selection detected:', { selText, coords });
            setSelectionCoords(coords);
            
            // Show popup with almost no delay now (50ms)
            if (popupTimeoutRef.current) {
              clearTimeout(popupTimeoutRef.current);
            }
            popupTimeoutRef.current = setTimeout(() => {
              setShowPopup(true);
              console.log('Popup state updated:', { showPopup: true });
            }, 50);
            return; // Exit early on successful processing
          } else {
            console.warn('Invalid selection rectangle:', rect);
          }
        } catch (error) {
          console.error('Error processing selection:', error);
        }
      }
      
      // If we reach here, either the selection is invalid or an error occurred
      // Hide popup if selection doesn't exist or is empty
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
      setShowPopup(false);
      console.log('No valid selection, hiding popup');
    };

    // Handle mouse events
    const handleMouseUp = (e: MouseEvent) => {
      // Don't process if click was inside the popup
      if (e.target instanceof Node) {
        const popupElement = document.querySelector('.text-selection-popup');
        if (popupElement && popupElement.contains(e.target)) {
          console.log('Click inside popup, ignoring');
          return;
        }
      }
      
      // Wait a moment for the selection to be updated
      setTimeout(handleSelection, 50); // Increased from 10ms to 50ms for better reliability
    };
    
    const handleMouseDown = (e: MouseEvent) => {
      // Don't hide popup if click was inside it
      if (e.target instanceof Node) {
        const popupElement = document.querySelector('.text-selection-popup');
        if (popupElement && popupElement.contains(e.target)) {
          return;
        }
      }
      
      // Hide popup and clear highlight when starting a new selection
      setShowPopup(false);
      clearPersistentHighlight(editor);
    };
    
    // Handle keydown for keyboard interaction
    const handleKeyDown = (e: KeyboardEvent) => {
      // If the key pressed is Delete or Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only clear if we're showing the popup
        if (showPopup) {
          setShowPopup(false);
          clearPersistentHighlight(editor);
          setSelectionRange(null);
          setSelectedText('');
          setSelectionCoords(null);
        }
      }
    };
    
    // Add event listeners
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, [showPopup]);

  // Function to add an action to history
  const addToActionHistory = (action: AIAction, instructions: string, modelName: GeminiModel) => {
    // If action is empty, it's a signal to close the popup, not an actual action
    if (!action) {
      setShowPopup(false);
      return;
    }
    
    // Set flag to ignore the next change detection in the editor
    // This prevents the AI-generated change from being logged as a manual edit
    textChangeTracker.current.ignoreNextChange = true;
    
    // Reset the ignore flag after a reasonable time 
    // (longer than the time it takes for the AI to update the editor)
    setTimeout(() => {
      textChangeTracker.current.ignoreNextChange = false;
    }, 2000);
    
    const newItem: ActionHistoryItem = {
      action,
      instructions,
      timestamp: Date.now(),
      modelName
    };
    
    setActionHistory(prevHistory => {
      // Add new item to beginning of history
      const updatedHistory = [newItem, ...prevHistory];
      // Limit to max history items
      const limitedHistory = updatedHistory.slice(0, MAX_ACTION_HISTORY);
      
      // Save to localStorage
      try {
        localStorage.setItem('actionHistory', JSON.stringify(limitedHistory));
      } catch (e) {
        console.error('Failed to save action history to localStorage:', e);
      }
      
      return limitedHistory;
    });
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      TextStyle,
      Placeholder.configure({
        placeholder: 'Start writing or paste text here. Select any text to use AI features...',
        emptyEditorClass: 'is-editor-empty',
      }),
      persistentHighlightExtension.current,
      Color,
    ],
    content: '<p>Type or paste your text here. Select any text to see AI options.</p>',
    immediatelyRender: false,
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
      },
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      
      if (from !== to) {
        // Store selection range for persistent highlighting
        setSelectionRange({ from, to });
        
        // Apply persistent highlight
        setPersistentHighlight(editor, { from, to });
        
        // Get the selected text
        const selectedText = editor.state.doc.textBetween(from, to, ' ');
        setSelectedText(selectedText);
      } else if (!showPopup) {
        // Only clear if popup is not shown (to prevent clearing when clicking in the popup)
        setSelectedText('');
        setSelectionCoords(null);
        setSelectionRange(null);
        clearPersistentHighlight(editor);
      }
    },
    onUpdate: ({ editor, transaction }) => {
      console.log('Content updated:', editor.getHTML());
      
      // Clear highlight and popup if content was deleted
      if (transaction.docChanged && selectionRange) {
        const { from, to } = selectionRange;
        
        // Check if the previously selected range is still valid
        const docSize = editor.state.doc.content.size;
        if (from >= docSize || to > docSize || from === to) {
          setShowPopup(false);
          clearPersistentHighlight(editor);
          setSelectionRange(null);
          setSelectedText('');
          setSelectionCoords(null);
        }
      }
      
      // Save editor content to localStorage
      const html = editor.getHTML();
      localStorage.setItem('editorContent', html);
      
      // Track manual edits with debounce
      trackManualEdits(editor);
    },
  });

  // Store the editor instance in a ref
  useEffect(() => {
    if (editor) {
      editorInstance.current = editor;
    }
  }, [editor]);

  // Track manual text edits
  const trackManualEdits = useCallback((editor: TiptapEditor) => {
    const debouncedTracking = debounce((editorInstance: TiptapEditor) => {
      if (!editorInstance || !textChangeTracker.current.isTracking) {
        // Start tracking after initial content is loaded
        if (!textChangeTracker.current.isTracking && editorInstance) {
          textChangeTracker.current.previousContent = editorInstance.getText();
          textChangeTracker.current.isTracking = true;
        }
        return;
      }
      
      // Skip tracking if this change was caused by an AI action
      if (textChangeTracker.current.ignoreNextChange) {
        // Just update the previous content without logging
        textChangeTracker.current.previousContent = editorInstance.getText();
        return;
      }
      
      const currentContent = editorInstance.getText();
      const previousContent = textChangeTracker.current.previousContent;
      
      // Skip if content hasn't changed
      if (currentContent === previousContent) return;
      
      // Simple change detection - this could be enhanced for more precise tracking
      if (currentContent.length > previousContent.length) {
        // Text was added
        const addedChars = currentContent.length - previousContent.length;
        
        // Only log significant additions (more than just a few characters)
        if (addedChars > 3) {
          // For manual edits, we need to handle differently since these aren't AIActions
          logEditHistory(
            previousContent, 
            currentContent, 
            'manual_add', 
            `Added approx. ${addedChars} characters`
          );
        }
      } else if (currentContent.length < previousContent.length) {
        // Text was deleted
        const removedChars = previousContent.length - currentContent.length;
        
        // Only log significant deletions
        if (removedChars > 3) {
          // For manual edits, we need to handle differently since these aren't AIActions
          logEditHistory(
            previousContent, 
            currentContent, 
            'manual_delete', 
            `Removed approx. ${removedChars} characters`
          );
        }
      }
      
      // Update previous content reference
      textChangeTracker.current.previousContent = currentContent;
    }, 1000); // 1 second debounce to avoid logging every keystroke
    
    debouncedTracking(editor);
  }, []); // Empty dependency array as we're only using refs inside the callback

  // Save model preference when it changes
  useEffect(() => {
    localStorage.setItem('selectedGeminiModel', activeModel);
    console.log('Model preference saved:', activeModel);
  }, [activeModel]);

  // Handle model change
  const handleModelChange = (model: GeminiModel) => {
    setActiveModel(model);
    localStorage.setItem('preferredModel', model);
    console.log('Model changed to:', model);
  };

  // Get label for model
  const getModelLabel = (model: GeminiModel): string => {
    switch(model) {
      case 'gemini-2.0-pro-exp-02-05': return 'Pro';
      case 'gemini-2.0-flash': return 'Flash';
      case 'gemini-2.0-flash-lite-preview-02-05': return 'Flash Lite';
      default: return model;
    }
  };
  
  // Get model description
  // const getModelDescription = (model: GeminiModel): string => {
  //   switch(model) {
  //     case 'gemini-2.0-pro-exp-02-05': return 'Best quality, slower';
  //     case 'gemini-2.0-flash': return 'Balanced speed/quality';
  //     case 'gemini-2.0-flash-lite-preview-02-05': return 'Fastest, lower quality';
  //     default: return '';
  //   }
  // };

  // Add a forced method to show the popup
  const forceShowPopupForCurrentSelection = useCallback(() => {
    console.log('Forcing popup display for current selection');
    const editor = editorInstance.current;
    if (!editor) {
      console.error('Cannot force popup - editor not available');
      return;
    }
    
    // Use the editor's selection to set state
    const { from, to } = editor.state.selection;
    
    // Only show if there's an actual selection
    if (from !== to) {
      const selectedText = editor.state.doc.textBetween(from, to, ' ');
      setSelectedText(selectedText);
      
      // Set coordinates based on editor position
      const editorElement = editor.view.dom;
      const editorRect = editorElement.getBoundingClientRect();
      
      // Position near the top of the editor as a fallback
      const coords = {
        x: editorRect.left + 50,
        y: editorRect.top + 50
      };
      
      console.log('Setting forced popup position:', coords);
      setSelectionCoords(coords);
      
      // Set selection range for persistent highlighting
      setSelectionRange({ from, to });
      
      // Apply persistent highlight
      setPersistentHighlight(editor, { from, to });
      
      // Show the popup immediately
      setShowPopup(true);
    } else {
      console.warn('Cannot force popup - no text selected in editor');
    }
  }, []);

  // Add keyboard shortcut for testing
  useEffect(() => {
    const handleKeyboardShortcut = (e: KeyboardEvent) => {
      // Ctrl+Shift+P to force popup
      if (e.ctrlKey && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        forceShowPopupForCurrentSelection();
      }
    };
    
    document.addEventListener('keydown', handleKeyboardShortcut);
    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcut);
    };
  }, [forceShowPopupForCurrentSelection]);

  if (!editor) {
    return <div>Loading editor...</div>;
  }
  
  // Helper functions for exporting content
  // const exportContent = (format: 'text' | 'html' | 'markdown') => {
  //   if (!editor) return;
    
  //   let content = '';
  //   let filename = `ai-editor-export-${new Date().toISOString().slice(0,10)}`;
  //   let mimeType = 'text/plain';
    
  //   switch (format) {
  //     case 'text':
  //       content = editor.getText();
  //       filename += '.txt';
  //       break;
  //     case 'html':
  //       content = editor.getHTML();
  //       filename += '.html';
  //       mimeType = 'text/html';
  //       break;
  //     case 'markdown':
  //       // Basic HTML to Markdown conversion (simplified)
  //       content = editor.getHTML()
  //         .replace(/<h1>(.*?)<\/h1>/g, '# $1\n\n')
  //         .replace(/<h2>(.*?)<\/h2>/g, '## $1\n\n')
  //         .replace(/<h3>(.*?)<\/h3>/g, '### $1\n\n')
  //         .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
  //         .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
  //         .replace(/<em>(.*?)<\/em>/g, '*$1*')
  //         .replace(/<u>(.*?)<\/u>/g, '_$1_')
  //         .replace(/<li>(.*?)<\/li>/g, '- $1\n')
  //         .replace(/<blockquote>(.*?)<\/blockquote>/g, '> $1\n\n')
  //         .replace(/<br\s*\/?>/g, '\n')
  //         .replace(/<[^>]*>/g, ''); // Remove any remaining HTML tags
  //       filename += '.md';
  //       break;
  //   }
    
  //   // Create the download
  //   const blob = new Blob([content], { type: mimeType });
  //   const url = URL.createObjectURL(blob);
  //   const a = document.createElement('a');
  //   a.href = url;
  //   a.download = filename;
  //   document.body.appendChild(a);
  //   a.click();
  //   document.body.removeChild(a);
  //   URL.revokeObjectURL(url);
    
  //   // Close the export menu after exporting
  //   // setExportMenuOpen(false);
  // };

  return (
    <div className="text-editor w-full max-w-4xl mx-auto rounded-xl overflow-hidden shadow-xl border border-gray-100 bg-white">
      <div className="border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-indigo-50 to-blue-50 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">AI Text Editor</h1>
        <div className="flex items-center gap-3">
          {/* Toggle model selector */}
          <div className="flex items-center border rounded-md overflow-hidden shadow-sm bg-white">
            <button 
              onClick={() => handleModelChange('gemini-2.0-pro-exp-02-05')}
              className={`px-3 py-1 text-sm ${activeModel === 'gemini-2.0-pro-exp-02-05' 
                ? 'bg-indigo-100 text-indigo-700 font-medium' 
                : 'bg-white hover:bg-gray-50'}`}
              title="Best quality, slower"
            >
              Pro
            </button>
            
            <div className="h-5 border-r"></div>
            
            <button 
              onClick={() => handleModelChange('gemini-2.0-flash')}
              className={`px-3 py-1 text-sm ${activeModel === 'gemini-2.0-flash' 
                ? 'bg-indigo-100 text-indigo-700 font-medium' 
                : 'bg-white hover:bg-gray-50'}`}
              title="Balanced speed/quality"
            >
              Flash
            </button>
            
            <div className="h-5 border-r"></div>
            
            <button 
              onClick={() => handleModelChange('gemini-2.0-flash-lite-preview-02-05')}
              className={`px-3 py-1 text-sm ${activeModel === 'gemini-2.0-flash-lite-preview-02-05' 
                ? 'bg-indigo-100 text-indigo-700 font-medium' 
                : 'bg-white hover:bg-gray-50'}`}
              title="Fastest, lower quality"
            >
              Flash Lite
            </button>
          </div>
          
          <button 
            onClick={() => setIsHistoryOpen(true)}
            className="px-3 py-1 bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 flex items-center text-sm shadow-sm"
          >
            <span className="mr-1">History</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </button>

          {/* Show AI Options button that appears when text is selected but popup isn't visible */}
          {selectedText && !showPopup && (
            <button 
              onClick={forceShowPopupForCurrentSelection}
              className="px-3 py-1 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 flex items-center text-sm shadow-sm"
              title="Ctrl+Shift+P"
            >
              <span className="mr-1">Show AI Options</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      <div className="bg-gray-50 px-2 py-1 border-b">
        <EditorMenuBar editor={editor} />
      </div>
      
      <div className="p-0">
        <div className="min-h-[400px] max-h-[70vh] overflow-y-auto">
          <EditorContent editor={editor} className="h-full" />
        </div>
      </div>
      
      <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 text-xs text-gray-500 flex justify-between items-center">
        <div>
          <span className="font-medium text-gray-600">Using: </span>
          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
            {getModelLabel(activeModel)}
          </span>
        </div>
        <div>
          Select text to see AI options
        </div>
      </div>
      
      {selectedText && selectionCoords && showPopup && (
        <TextSelectionPopup 
          text={selectedText} 
          position={selectionCoords} 
          editor={editor}
          className="text-selection-popup"
          onActionPerformed={addToActionHistory}
          actionHistory={actionHistory}
          modelName={activeModel}
        />
      )}
      
      {isHistoryOpen && <EditHistoryViewer onClose={() => setIsHistoryOpen(false)} />}
    </div>
  );
};

export default Editor; 