"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { EditorContent } from '@tiptap/react';
import { useEditorInitialization } from '../hooks/useEditorInitialization';
import { useSelectionHandling } from '../hooks/useSelectionHandling';
import { useActionHistory } from '../hooks/useActionHistory';
import { useTextChangeTracking } from '../hooks/useTextChangeTracking';
import { useExportMenu } from '../hooks/useExportMenu';
import { useModelSelection } from '../hooks/useModelSelection';
import { getSelectionRect } from '../../../utils/selectionUtils';
import { getSelectedText } from '../../../utils/selectionUtils';
import { clearAllHighlights, highlightSelection } from '../../../utils/highlightUtils';
import ExportMenu from '../ui/ExportMenu';
import TextSelectionPopup from '../../../components/TextSelectionPopup';
import EditHistoryViewer from '../../../components/EditHistoryViewer';
import EditorMenuBar from '../../../components/EditorMenuBar';
import TokenUsageDisplay from '../../../components/TokenUsageDisplay';
import { DEFAULT_MODEL, GeminiModel, AIAction } from '../../../services/geminiService';

const EditorContainer: React.FC = () => {
  // State for UI elements
  const [showPopup, setShowPopup] = useState(false);
  const [selectionCoords, setSelectionCoords] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<GeminiModel>('gemini-2.0-flash');
  const [isMonospaceFont, setIsMonospaceFont] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  
  // Initialize editor
  const { editor, isEditorReady, getContent, setContent } = useEditorInitialization({
    isMonospaceFont
  });
  
  // Use custom hooks
  const { actionHistory, addActionToHistory, clearActionHistory } = useActionHistory();
  const { startTracking, stopTracking, ignoreNextChange } = useTextChangeTracking({
    editor,
    onContentChange: (content) => {
      console.log('Content changed:', content.substring(0, 50) + '...');
    }
  });
  const { showExportMenu, toggleExportMenu, closeExportMenu, exportAsHTML, exportAsMarkdown, exportAsText } = useExportMenu({ editor });
  const { showModelSelector, closeModelSelector, handleModelSelect: originalHandleModelSelect } = useModelSelection(DEFAULT_MODEL);
  
  // Handle AI action performed
  const handleActionPerformed = useCallback((action: AIAction, instructions: string, modelName: GeminiModel) => {
    // If action is empty, it's a signal to close the popup, not an actual action
    if (!action) {
      setShowPopup(false);
      return;
    }
    
    // Handle special markers
    if (instructions === 'STARTING') {
      // Set AI processing flag when action starts
      setIsAiProcessing(true);
      return;
    } else if (instructions === 'COMPLETED') {
      // Clear AI processing flag when action completes
      setTimeout(() => {
        setIsAiProcessing(false);
      }, 500); // Small delay to ensure UI updates properly
      return;
    }
    
    // Normal action handling for regular instructions
    // Set flag to ignore the next change detection in the editor
    // This prevents the AI-generated change from being logged as a manual edit
    ignoreNextChange();
    
    // Add to action history
    addActionToHistory(action, instructions, modelName);
    
    // Keep the popup visible - don't close it after action
    // This allows the user to perform another action on the same text
  }, [addActionToHistory, ignoreNextChange]);
  
  // Handle model selection
  const handleModelSelect = useCallback((model: GeminiModel) => {
    originalHandleModelSelect(model);
    setSelectedModel(model);
    
    // Show notification
    const notification = document.createElement('div');
    notification.className = 'fixed bottom-4 right-4 bg-indigo-600 text-white px-4 py-2 rounded-md shadow-lg transition-opacity duration-300';
    notification.textContent = `Switched to ${model}`;
    document.body.appendChild(notification);
    
    // Remove notification after delay
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 2000);
  }, [originalHandleModelSelect]);
  
  // Toggle export menu
  const handleToggleExportMenu = useCallback(() => {
    toggleExportMenu();
    
    // Close model selector if open
    if (showModelSelector) {
      closeModelSelector();
    }
  }, [toggleExportMenu, showModelSelector, closeModelSelector]);
  
  // Toggle monospace font
  const handleToggleMonospace = useCallback(() => {
    setIsMonospaceFont(prev => !prev);
  }, []);
  
  // Handle showing popup
  const handleShowPopup = useCallback((shouldShow: boolean) => {
    // If AI is processing and we're trying to hide the popup, ignore it
    if (!shouldShow && isAiProcessing) {
      console.log('Ignoring popup hide request during AI processing');
      return;
    }
    
    setShowPopup(shouldShow);
    
    if (shouldShow && editor) {
      // Get the selected text
      const text = getSelectedText(editor);
      setSelectedText(text);
      
      // Get the selection coordinates
      const rect = getSelectionRect();
      if (rect) {
        setSelectionCoords({
          x: rect.left + window.scrollX,
          y: rect.bottom + window.scrollY
        });
      }
      
      // Automatically highlight the selected text when showing the popup
      highlightSelection(editor);
    } else if (!shouldShow && editor) {
      setSelectedText(null);
      setSelectionCoords(null);
      
      // Don't automatically clear highlights when hiding popup
      // This allows highlights to persist until explicitly cleared
    }
  }, [editor, isAiProcessing]);
  
  // Use selection handling hook
  const { 
    handleMouseDown, 
    handleMouseUp, 
    handleDragStart, 
    handleDragEnd, 
    handleSelectionChange 
  } = useSelectionHandling({ 
    editor, 
    onShowPopup: handleShowPopup 
  });
  
  // Subscribe to editor selection changes
  useEffect(() => {
    if (!editor) return;
    
    // Use the event handler pattern
    const onSelectionUpdate = () => {
      handleSelectionChange();
    };
    
    editor.on('selectionUpdate', onSelectionUpdate);
    
    return () => {
      editor.off('selectionUpdate', onSelectionUpdate);
    };
  }, [editor, handleSelectionChange]);
  
  // Start tracking text changes when editor is ready
  useEffect(() => {
    if (isEditorReady && editor) {
      startTracking();
    }
    
    return () => {
      stopTracking();
    };
  }, [isEditorReady, editor, startTracking, stopTracking]);
  
  // Handle click outside to close menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close export menu if clicking outside
      if (showExportMenu) {
        const exportButton = document.querySelector('[data-export-button]');
        const exportMenu = document.querySelector('[data-export-menu]');
        
        if (exportButton && 
            !exportButton.contains(event.target as Node) && 
            (!exportMenu || !exportMenu.contains(event.target as Node))) {
          closeExportMenu();
        }
      }
      
      // Don't hide popup during AI processing
      if (isAiProcessing) {
        return;
      }
      
      // Hide popup when clicking outside editor and popup
      if (showPopup) {
        const editorElement = document.querySelector('.ProseMirror');
        const popupElement = document.querySelector('.text-selection-popup');
        
        // First, check if the click target is the popup or a child of the popup
        if (popupElement && popupElement.contains(event.target as Node)) {
          // If clicking inside the popup, don't close it
          console.log('Click inside popup detected - keeping popup open');
          
          // Check if clicking on an input field
          const target = event.target as HTMLElement;
          if (target.tagName.toLowerCase() === 'input') {
            console.log('Click on input field - allowing default behavior');
            // Let the input field handle the click, but prevent closing
            event.stopPropagation();
            return;
          }
          
          // For non-input elements in the popup, prevent all default behavior
          event.stopPropagation();
          event.preventDefault();
          return;
        }
        
        // Don't close if the click was on the selected text
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          if (range.toString().trim().length > 0) {
            // If clicking on selected text, don't close the popup
            const rangeRect = range.getBoundingClientRect();
            if (event.clientX >= rangeRect.left && 
                event.clientX <= rangeRect.right && 
                event.clientY >= rangeRect.top && 
                event.clientY <= rangeRect.bottom) {
              console.log('Click on selected text - keeping popup open');
              return;
            }
          }
        }
        
        // Close popup if clicking outside both editor and popup
        if (editorElement && 
            !editorElement.contains(event.target as Node) && 
            (!popupElement || !popupElement.contains(event.target as Node))) {
          console.log('Click outside editor and popup - closing popup');
          setShowPopup(false);
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu, showPopup, closeExportMenu, isAiProcessing]);
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyboardShortcut = (e: KeyboardEvent) => {
      // Only process if editor is ready
      if (!editor || !isEditorReady) return;
      
      // Check for Escape key to clear highlights
      if (e.key === 'Escape') {
        clearAllHighlights(editor);
        return;
      }
      
      // Check for Ctrl/Cmd + key combinations
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'e':
            e.preventDefault();
            handleToggleExportMenu();
            break;
          case 'm':
            e.preventDefault();
            // Cycle through models on keyboard shortcut
            const models: GeminiModel[] = [
              'gemini-2.0-flash',
              'gemini-2.0-pro-exp-02-05',
              'gemini-2.0-flash-lite'
            ];
            const currentIndex = models.findIndex(model => model === selectedModel);
            const nextIndex = (currentIndex + 1) % models.length;
            handleModelSelect(models[nextIndex]);
            break;
          case 'h':
            e.preventDefault();
            setIsHistoryOpen(true);
            break;
          case 'c':
            // Only handle if there's no selection (let browser handle normal copy)
            if (!editor.state.selection.empty) {
              // Let the browser's default copy behavior work for selections
              return;
            }
            
            e.preventDefault();
            if (editor) {
              // Copy current content when nothing is selected
              navigator.clipboard.writeText(getContent());
            }
            break;
          case 'x':
            // Only handle if there's no selection (let browser handle normal cut)
            if (!editor.state.selection.empty) {
              // Let the browser's default cut behavior work for selections
              return;
            }
            
            e.preventDefault();
            if (editor) {
              // Clear entire content when nothing is selected
              setContent('');
              clearActionHistory();
            }
            break;
          case 'i':
            e.preventDefault();
            if (editor) {
              // Prevent tracking the next change (useful for manual editing)
              ignoreNextChange();
            }
            break;
          case '`':
            e.preventDefault();
            // Toggle monospace font
            handleToggleMonospace();
            break;
        }
      }
      
      // Ctrl+Shift+P to force show the popup for current selection
      if (e.ctrlKey && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        console.log('Keyboard shortcut Ctrl+Shift+P detected - forcing popup');
        
        // Get current selection and show popup
        const text = getSelectedText(editor);
        if (text) {
          setSelectedText(text);
          
          // Get coordinates
          const rect = getSelectionRect();
          if (rect) {
            setSelectionCoords({
              x: rect.left + window.scrollX,
              y: rect.bottom + window.scrollY
            });
            setShowPopup(true);
          }
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyboardShortcut);
    
    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcut);
    };
  }, [editor, isEditorReady, handleToggleExportMenu, selectedModel, handleModelSelect, getContent, setContent, clearActionHistory, ignoreNextChange, handleToggleMonospace]);
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center px-4 py-2 border-b bg-gradient-to-r from-indigo-50 to-blue-50">
        <div className="flex items-center">
          <h2 className="text-xl font-semibold text-gray-800">Quick AI Text Editor</h2>
          {editor && <TokenUsageDisplay editor={editor} className="ml-4" />}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleMonospace}
            className={`px-3 py-1 border text-sm rounded-md shadow-sm flex items-center ${
              isMonospaceFont 
                ? 'bg-indigo-100 text-indigo-800 border-indigo-200 font-medium' 
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
            title="Toggle Monospace Font (Ctrl+`)"
          >
            <span className="font-mono">Monospace</span>
          </button>
          
          <div className="flex rounded-md shadow-sm overflow-hidden border border-gray-200">
            <button
              onClick={() => handleModelSelect('gemini-2.0-flash')}
              className={`px-3 py-1 text-sm ${
                selectedModel === 'gemini-2.0-flash' 
                  ? 'bg-indigo-100 text-indigo-800 font-medium' 
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Flash
            </button>
            <div className="w-px bg-gray-200"></div>
            <button
              onClick={() => handleModelSelect('gemini-2.0-pro-exp-02-05')}
              className={`px-3 py-1 text-sm ${
                selectedModel === 'gemini-2.0-pro-exp-02-05' 
                  ? 'bg-indigo-100 text-indigo-800 font-medium' 
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Pro
            </button>
            <div className="w-px bg-gray-200"></div>
            <button
              onClick={() => handleModelSelect('gemini-2.0-flash-lite')}
              className={`px-3 py-1 text-sm ${
                selectedModel === 'gemini-2.0-flash-lite' 
                  ? 'bg-indigo-100 text-indigo-800 font-medium' 
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Lite
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
          
          <div className="relative">
            <button
              onClick={handleToggleExportMenu}
              className="px-3 py-1 bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 flex items-center text-sm shadow-sm"
              data-export-button
            >
              <span>Export</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showExportMenu && (
              <ExportMenu
                isOpen={showExportMenu}
                onExportHTML={exportAsHTML}
                onExportMarkdown={exportAsMarkdown}
                onExportText={exportAsText}
                onClose={closeExportMenu}
              />
            )}
          </div>
        </div>
      </div>
      
      <div className="bg-gray-50 px-2 py-1 border-b">
        {editor && <EditorMenuBar editor={editor} />}
      </div>
      
      <div className="flex-grow">
        <div 
          className={`editor-container min-h-[400px] max-h-[70vh] overflow-y-auto ${isMonospaceFont ? 'font-mono' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <EditorContent editor={editor} className="h-full" />
        </div>
      </div>
      
      <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 text-xs text-gray-500 flex justify-between items-center">
        <div>
          <span className="font-medium text-gray-600">Using: </span>
          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
            {selectedModel}
          </span>
          {isMonospaceFont && (
            <span className="ml-2 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium font-mono">
              Monospace
            </span>
          )}
        </div>
        <div>
          Select text to see AI options • <span className="text-gray-600 font-medium">Ctrl+Shift+P</span> to force popup • <span className="text-gray-600 font-medium">Ctrl+`</span> for monospace
        </div>
      </div>
      
      {isHistoryOpen && <EditHistoryViewer onClose={() => setIsHistoryOpen(false)} />}
      
      <TextSelectionPopup 
        text={selectedText || ''} 
        position={selectionCoords || { x: 0, y: 0 }} 
        editor={editor!}
        className="text-selection-popup"
        onActionPerformed={handleActionPerformed}
        actionHistory={actionHistory}
        modelName={selectedModel}
        isVisible={showPopup && !!selectedText && !!selectionCoords}
      />
    </div>
  );
};

export default EditorContainer; 