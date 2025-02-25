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
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [actionHistory, setActionHistory] = useState<ActionHistoryItem[]>([]);
  const [selectionRange, setSelectionRange] = useState<{ from: number; to: number } | null>(null);
  const popupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorInstance = useRef<TiptapEditor | null>(null);
  const persistentHighlightExtension = useRef<typeof PersistentHighlight | null>(null);
  const lastMouseUpTime = useRef<number>(0);
  const lastKeyUpTime = useRef<number>(0);
  const textChangeTracker = useRef<TextChangeTracker>({
    previousContent: '',
    changeTimer: null,
    isTracking: false,
    ignoreNextChange: false
  });
  const isSelecting = useRef<boolean>(false);
  const selectionEndTimeout = useRef<NodeJS.Timeout | null>(null);
  const isDragging = useRef<boolean>(false);

  // Model selection state with default value
  const [activeModel, setActiveModel] = useState<GeminiModel>(DEFAULT_MODEL);

  // Add a ref for the export menu
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Add a click outside handler for the export menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };

    if (exportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [exportMenuOpen]);

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
        'gemini-2.0-flash-lite'
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

  // Add a debounced function to show the popup
  const debouncedShowPopup = useCallback((shouldShow: boolean) => {
    // Create a debounced function inline
    const showPopupWithDelay = () => {
      if (shouldShow && !isSelecting.current && !isDragging.current) {
        console.log('Debounced popup show triggered');
        setShowPopup(true);
      }
    };
    
    // Add a small delay to ensure selection is stable
    setTimeout(showPopupWithDelay, 200);
  }, [isSelecting, isDragging]);

  // Effect to handle selection changes
  useEffect(() => {
    const handleSelectionChange = () => {
      if (isDragging.current || isSelecting.current) {
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        // Clear the popup after a delay to allow for interactions with the popup
        const currentPopupTimeout = setTimeout(() => {
          setShowPopup(false);
        }, 300);
        popupTimeoutRef.current = currentPopupTimeout;
        return;
      }

      // Set a timeout to consider the selection as "ended" after a short delay
      const currentSelectionEndTimeout = setTimeout(() => {
        debouncedShowPopup(true);
      }, 500);
      selectionEndTimeout.current = currentSelectionEndTimeout;
    };

    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      // Store the current ref values in variables to use in cleanup
      const currentPopupTimeout = popupTimeoutRef.current;
      const currentSelectionEndTimeout = selectionEndTimeout.current;
      
      if (currentPopupTimeout) {
        clearTimeout(currentPopupTimeout);
      }
      
      if (currentSelectionEndTimeout) {
        clearTimeout(currentSelectionEndTimeout);
      }
    };
  }, [debouncedShowPopup, selectionRange]);

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
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: true, // Keep attributes when toggling lists
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: true, // Keep attributes when toggling lists
        },
      }),
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
        
        // Get coordinates for the popup - this is crucial for the first selection
        try {
          const domSelection = window.getSelection();
          if (domSelection && domSelection.rangeCount > 0) {
            const range = domSelection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            // Only set coords if we got a valid rectangle
            if (rect && rect.width > 0 && rect.height > 0) {
              const coords = {
                x: rect.left + window.scrollX,
                y: rect.bottom + window.scrollY
              };
              
              console.log('Selection update coords:', coords);
              setSelectionCoords(coords);
              
              // CRITICAL FIX: Don't show popup if user is still actively selecting text
              // This prevents the popup from appearing prematurely during selection
              if (isSelecting.current || isDragging.current) {
                console.log('Selection update detected but user is still selecting, not showing popup');
                return;
              }
              
              // We need to handle both user-initiated and programmatic selections
              // Check if this selection was made by a recent user interaction
              const now = Date.now();
              const lastInteractionTime = Math.max(
                lastMouseUpTime.current || 0,
                lastKeyUpTime.current || 0
              );
              
              // Only show popup if:
              // 1. This is a programmatic selection (not from recent mouse/keyboard)
              // 2. OR if it's been more than 300ms since the last interaction (selection is stable)
              // 3. AND the user is not actively selecting text
              if (now - lastInteractionTime > 300) {
                console.log('Programmatic or stable selection detected, scheduling popup');
                // Use debounced function instead of direct timeout
                debouncedShowPopup(true);
              }
            }
          }
        } catch (error) {
          console.error('Error getting selection coordinates:', error);
        }
      } else if (!showPopup) {
        // Selection is collapsed (no text selected)
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
      case 'gemini-2.0-flash-lite': return 'Flash Lite';
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
      
      // Set coordinates based on selection position
      try {
        const domSelection = window.getSelection();
        if (domSelection && domSelection.rangeCount > 0) {
          const range = domSelection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          if (rect && rect.width > 0 && rect.height > 0) {
            const coords = {
              x: rect.left + window.scrollX,
              y: rect.bottom + window.scrollY
            };
            
            console.log('Setting forced popup position from selection:', coords);
            setSelectionCoords(coords);
          } else {
            // Fallback to editor position if selection rect is invalid
            const editorElement = editor.view.dom;
            const editorRect = editorElement.getBoundingClientRect();
            
            const coords = {
              x: editorRect.left + 50,
              y: editorRect.top + 50
            };
            
            console.log('Setting forced popup position from editor:', coords);
            setSelectionCoords(coords);
          }
        }
      } catch (error) {
        console.error('Error getting selection coordinates for forced popup:', error);
        
        // Fallback to editor position
        const editorElement = editor.view.dom;
        const editorRect = editorElement.getBoundingClientRect();
        
        const coords = {
          x: editorRect.left + 50,
          y: editorRect.top + 50
        };
        
        console.log('Setting fallback forced popup position:', coords);
        setSelectionCoords(coords);
      }
      
      // Set selection range for persistent highlighting
      setSelectionRange({ from, to });
      
      // Apply persistent highlight
      setPersistentHighlight(editor, { from, to });
      
      // Force the popup to show immediately (bypass debounce)
      // This is intentional for the keyboard shortcut
      console.log('Force showing popup immediately (bypassing debounce)');
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
        console.log('Keyboard shortcut Ctrl+Shift+P detected - forcing popup');
        forceShowPopupForCurrentSelection();
      }
    };
    
    document.addEventListener('keydown', handleKeyboardShortcut);
    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcut);
    };
  }, [forceShowPopupForCurrentSelection]);

  // Add a special initialization effect to ensure everything is ready
  useEffect(() => {
    console.log('Editor component mounted, initializing selection handling');
    
    // Force a re-render of the editor after a short delay to ensure all event handlers are properly bound
    const initTimer = setTimeout(() => {
      const editor = editorInstance.current;
      if (editor) {
        console.log('Editor fully initialized and ready for selections');
        
        // Check if there's already a selection when the component mounts
        const { from, to } = editor.state.selection;
        if (from !== to) {
          console.log('Initial selection detected, range:', { from, to });
          
          // Get the selected text
          const selectedText = editor.state.doc.textBetween(from, to, ' ');
          console.log('Initial selected text:', selectedText);
          
          // This will trigger the selection update handler
          editor.commands.focus();
        }
      }
    }, 500);
    
    return () => clearTimeout(initTimer);
  }, []); // Empty dependency array means this runs once on mount

  // Add debug logging to the setShowPopup state change
  useEffect(() => {
    console.log('Popup visibility changed:', showPopup);
  }, [showPopup]);

  // Helper functions for exporting content
  const exportContent = (format: 'text' | 'html' | 'markdown') => {
    if (!editor) return;
    
    let content = '';
    let filename = `ai-editor-export-${new Date().toISOString().slice(0,10)}`;
    let mimeType = 'text/plain';
    
    switch (format) {
      case 'text':
        content = editor.getText();
        filename += '.txt';
        break;
      case 'html':
        content = editor.getHTML();
        filename += '.html';
        mimeType = 'text/html';
        break;
      case 'markdown':
        // Basic HTML to Markdown conversion (simplified)
        content = editor.getHTML()
          .replace(/<h1>(.*?)<\/h1>/g, '# $1\n\n')
          .replace(/<h2>(.*?)<\/h2>/g, '## $1\n\n')
          .replace(/<h3>(.*?)<\/h3>/g, '### $1\n\n')
          .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
          .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
          .replace(/<em>(.*?)<\/em>/g, '*$1*')
          .replace(/<u>(.*?)<\/u>/g, '_$1_')
          .replace(/<li>(.*?)<\/li>/g, '- $1\n')
          .replace(/<blockquote>(.*?)<\/blockquote>/g, '> $1\n\n')
          .replace(/<br\s*\/?>/g, '\n')
          .replace(/<[^>]*>/g, ''); // Remove any remaining HTML tags
        filename += '.md';
        break;
    }
    
    // Create the download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Close the export menu after exporting
    setExportMenuOpen(false);
  };

  if (!editor) {
    return <div>Loading editor...</div>;
  }
  
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
              onClick={() => handleModelChange('gemini-2.0-flash-lite')}
              className={`px-3 py-1 text-sm ${activeModel === 'gemini-2.0-flash-lite' 
                ? 'bg-indigo-100 text-indigo-700 font-medium' 
                : 'bg-white hover:bg-gray-50'}`}
              title="Fastest, lower quality"
            >
              Flash Lite
            </button>
          </div>
          
          {/* Export dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button 
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="px-3 py-1 bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 flex items-center text-sm shadow-sm"
            >
              <span className="mr-1">Export</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </button>
            
            {exportMenuOpen && (
              <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                <div className="py-1">
                  <button 
                    onClick={() => exportContent('text')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Plain Text (.txt)
                  </button>
                  <button 
                    onClick={() => exportContent('html')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    HTML (.html)
                  </button>
                  <button 
                    onClick={() => exportContent('markdown')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Markdown (.md)
                  </button>
                </div>
              </div>
            )}
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
          Select text to see AI options • <span className="text-gray-600 font-medium">Ctrl+Shift+P</span> to force popup
        </div>
      </div>
      
      {/* Always render the popup but control its visibility with props */}
      <TextSelectionPopup 
        text={selectedText || ''} 
        position={selectionCoords || { x: 0, y: 0 }} 
        editor={editor}
        className="text-selection-popup"
        onActionPerformed={addToActionHistory}
        actionHistory={actionHistory}
        modelName={activeModel}
        isVisible={showPopup && !!selectedText && !!selectionCoords}
      />
      
      {isHistoryOpen && <EditHistoryViewer onClose={() => setIsHistoryOpen(false)} />}
    </div>
  );
};

export default Editor; 