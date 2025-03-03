"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { transformText, logEditHistory, AIAction, GeminiModel, DEFAULT_MODEL, countWords, getWordLimit } from '../services/geminiService';

// Type for action history item
interface ActionHistoryItem {
  action: AIAction;
  instructions: string;
  timestamp: number;
  modelName?: GeminiModel;
}

type TextSelectionPopupProps = {
  text: string;
  position: { x: number; y: number };
  editor: Editor;
  className?: string;
  actionHistory?: ActionHistoryItem[];
  onActionPerformed?: (action: AIAction, instructions: string, modelName: GeminiModel) => void;
  modelName?: GeminiModel;
  isVisible?: boolean;
};

const TextSelectionPopup: React.FC<TextSelectionPopupProps> = ({
  text,
  position,
  editor,
  className = '',
  actionHistory = [],
  onActionPerformed,
  modelName = DEFAULT_MODEL,
  isVisible = false,
}) => {
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOverTokenLimit, setIsOverTokenLimit] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Log props for debugging in production
  useEffect(() => {
    console.log('TextSelectionPopup props:', {
      hasText: !!text,
      textLength: text?.length || 0,
      position,
      editorExists: !!editor,
      modelName,
      isVisible
    });
  }, [text, position, editor, modelName, isVisible]);

  // Check if document exceeds word limit on mount and when visible
  useEffect(() => {
    if (!editor || !isVisible) return;
    
    const checkWordLimit = () => {
      const documentContent = editor.getHTML();
      const documentWords = countWords(documentContent);
      const wordLimit = getWordLimit();
      
      const isOverLimit = documentWords > wordLimit;
      setIsOverTokenLimit(isOverLimit);
      
      // Set error message if over limit
      if (isOverLimit) {
        const percentage = Math.round((documentWords / wordLimit) * 100);
        setErrorMessage(
          `Text length exceeds word limit: ${documentWords.toLocaleString()} / ${wordLimit.toLocaleString()} (${percentage}%)
          Please reduce your text length.`
        );
      } else {
        // Clear error message if we're back under the limit
        if (errorMessage && errorMessage.includes('word limit')) {
          setErrorMessage(null);
        }
      }
    };
    
    // Check immediately when popup becomes visible
    checkWordLimit();
    
    // Also set up an interval to check periodically while popup is open
    const intervalId = setInterval(checkWordLimit, 2000);
    
    return () => clearInterval(intervalId);
  }, [editor, isVisible, errorMessage]);

  // Position the popup and ensure it's within viewport
  useEffect(() => {
    const popup = popupRef.current;
    if (!popup || !isVisible) return;

      // Get popup dimensions
      const rect = popup.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
    // Get current position from the inline styles
    const currentX = position.x - (position.x > window.innerWidth / 2 ? 260 : 0);
    const currentY = position.y + 6;
    
    // Simple boundary checking to keep popup within viewport
    if (currentX + rect.width > viewportWidth) {
      popup.style.left = `${viewportWidth - rect.width - 10}px`;
    }
    
    if (currentX < 10) {
      popup.style.left = '10px';
    }
    
    if (currentY + rect.height > viewportHeight) {
      popup.style.top = `${viewportHeight - rect.height - 10}px`;
    }
    
    if (currentY < 10) {
      popup.style.top = '10px';
    }
    
    // Ensure high z-index
    popup.style.zIndex = '9999';
  }, [position, isVisible]);

  const handleAIAction = async (action: AIAction) => {
    setIsLoading(true);
    setErrorMessage(null); // Clear any previous errors
    
    try {
      // Get the full document content for better context
      const documentContent = editor.getHTML();
      
      // Show a visual indicator in the editor to help user understand processing is happening
      const { from, to } = editor.state.selection;
      const originalText = editor.state.doc.textBetween(from, to, ' ');
      
      // Add a processing indicator
      editor.commands.setTextSelection({ from, to });
      
      console.log(`Processing with model: ${modelName}`);
      
      // Transform the text using the Gemini API
      const result = await transformText({
        text,
        action,
        additionalInstructions: additionalInstructions || undefined,
        fullDocument: documentContent
      }, modelName);
      
      if (result) {
        // Replace the selected text with the transformed text
        editor.commands.deleteSelection();
        const insertPos = editor.state.selection.from;
        editor.commands.insertContent(result);
        
        // Calculate the new selection range based on the inserted content length
        const newFrom = insertPos;
        const newTo = insertPos + result.length;
        
        // Set selection to the entire transformed text
        editor.commands.setTextSelection({ from: newFrom, to: newTo });
        
        // Clear the persistent highlight after transformation
        const extension = editor.extensionManager.extensions.find(
          ext => ext.name === 'persistentHighlight'
        );
        
        if (extension) {
          // Clear highlights
          extension.storage.highlights = [];
            editor.view.dispatch(editor.state.tr); // Force redraw
        }
        
        // Explicitly log the edit to history with all details
        logEditHistory(
          originalText,        // Original text before transformation
          result,              // Transformed text
          action,              // The AI action performed
          additionalInstructions || undefined,
          modelName            // The model used
        );
        
        // Log to action history for the UI
        if (onActionPerformed) {
          console.log('Adding to action history in UI:', action, additionalInstructions, modelName);
          onActionPerformed(action, additionalInstructions || '', modelName);
        }
      } else {
        console.error('Transformation failed: Empty result');
        setErrorMessage('Error: Failed to transform text');
      }
    } catch (error) {
      console.error('Error during text transformation:', error);
      
      // Check if it's a word limit error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('word limit')) {
        // Display a more user-friendly message for word limit errors
        const wordLimit = getWordLimit();
        const documentContent = editor.getHTML();
        const documentWords = countWords(documentContent);
        
        setErrorMessage(`Document length exceeds the word limit (${documentWords} > ${wordLimit}). 
          Please reduce your document size or increase the limit in environment variables.`);
      } else {
        setErrorMessage('Failed to process text. Please try again.');
      }
    } finally {
      setIsLoading(false);
      
      // Only close popup if no error occurred
      if (!errorMessage) {
      setShowHistory(false);
      // Close popup after action completes
      setTimeout(() => {
        if (onActionPerformed) {
          onActionPerformed('' as AIAction, '', modelName); // Signal to close popup
        }
      }, 500);
      }
    }
  };
  
  // Apply a historical action
  const applyHistoricalAction = (item: ActionHistoryItem) => {
    setAdditionalInstructions(item.instructions);
    handleAIAction(item.action);
  };
  
  // Get text label for action type
  const getActionLabel = (action: AIAction): string => {
    switch(action) {
      case 'expand': return 'Expand';
      case 'summarize': return 'Summarize';
      case 'rephrase': return 'Rephrase';
      case 'revise': return 'Revise';
      default: return action;
    }
  };
  
  // Get color class for action type
  const getActionColor = (action: AIAction): string => {
    switch(action) {
      case 'expand': return 'bg-indigo-500 hover:bg-indigo-600';
      case 'summarize': return 'bg-green-500 hover:bg-green-600';
      case 'rephrase': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'revise': return 'bg-purple-500 hover:bg-purple-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  // Prevent mousedown events from bubbling up when clicking inside the popup
  // This helps prevent the popup from closing when clicking inside input fields
  const handlePopupMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    // More aggressive prevention of event propagation
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation?.();
      e.nativeEvent.stopPropagation?.();
      e.nativeEvent.preventDefault?.();
    }
    console.log('Popup mousedown intercepted and stopped');
  };

  // Prevent all events from bubbling up from the popup
  const handlePopupEvent = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // More aggressive prevention of event propagation
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation?.();
      e.nativeEvent.stopPropagation?.();
      e.nativeEvent.preventDefault?.();
    }
    console.log('Popup event intercepted and stopped');
  };

  // Handle input field focus and interaction
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.stopPropagation();
    // Remove preventDefault to allow focus
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation?.();
      e.nativeEvent.stopPropagation?.();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    // Remove preventDefault to allow input changes
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation?.();
      e.nativeEvent.stopPropagation?.();
    }
    setAdditionalInstructions(e.target.value);
  };

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
    // Remove preventDefault to allow clicking
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation?.();
      e.nativeEvent.stopPropagation?.();
    }
  };

  // Get button class with disabled state if over token limit
  const getButtonClass = (baseClass: string): string => {
    if (isOverTokenLimit) {
      return `${baseClass.split(' ')[0]} bg-opacity-50 cursor-not-allowed text-white px-2.5 py-1.5 rounded-md text-sm font-medium shadow-sm`;
    }
    return baseClass;
  };

  if (!isVisible) return null;

  return (
    <div
      className={`${className} text-selection-popup p-2 rounded-lg shadow-lg min-w-[260px] max-w-[320px]`}
      style={{ 
        position: 'absolute',
        left: `${position.x - (position.x > window.innerWidth / 2 ? 260 : 0)}px`,
        top: `${position.y + 6}px`,
        pointerEvents: 'auto'
      }}
      onMouseDown={handlePopupMouseDown}
      onClick={handlePopupEvent}
      onMouseUp={handlePopupEvent}
      onMouseMove={handlePopupEvent}
      ref={popupRef}
    >
      <div 
        className="bg-white shadow-lg rounded-lg border border-gray-200 overflow-hidden w-64"
        style={{ pointerEvents: 'auto' }} // Re-enable pointer events for the content
      >
        <div className="p-3 space-y-3">
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-xs mb-2">
              {errorMessage}
            </div>
          )}
          
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={(e) => {
                handlePopupEvent(e);
                if (!isOverTokenLimit) handleAIAction('expand');
              }}
              className={getButtonClass("bg-indigo-500 text-white px-2.5 py-1.5 rounded-md text-sm font-medium hover:bg-indigo-600 shadow-sm transition-colors")}
              disabled={isLoading || isOverTokenLimit}
            >
              Expand
            </button>
            <button
              onClick={(e) => {
                handlePopupEvent(e);
                if (!isOverTokenLimit) handleAIAction('summarize');
              }}
              className={getButtonClass("bg-green-500 text-white px-2.5 py-1.5 rounded-md text-sm font-medium hover:bg-green-600 shadow-sm transition-colors")}
              disabled={isLoading || isOverTokenLimit}
            >
              Summarize
            </button>
            <button
              onClick={(e) => {
                handlePopupEvent(e);
                if (!isOverTokenLimit) handleAIAction('rephrase');
              }}
              className={getButtonClass("bg-yellow-500 text-white px-2.5 py-1.5 rounded-md text-sm font-medium hover:bg-yellow-600 shadow-sm transition-colors")}
              disabled={isLoading || isOverTokenLimit}
            >
              Rephrase
            </button>
            <button
              onClick={(e) => {
                handlePopupEvent(e);
                if (!isOverTokenLimit) handleAIAction('revise');
              }}
              className={getButtonClass("bg-purple-500 text-white px-2.5 py-1.5 rounded-md text-sm font-medium hover:bg-purple-600 shadow-sm transition-colors")}
              disabled={isLoading || isOverTokenLimit}
            >
              Revise
            </button>
            
            {actionHistory.length > 0 && (
              <button
                onClick={(e) => {
                  handlePopupEvent(e);
                  setShowHistory(!showHistory);
                }}
                className="bg-gray-100 text-gray-700 px-2 py-1.5 rounded-md text-sm hover:bg-gray-200 shadow-sm border border-gray-200 transition-colors"
                disabled={isLoading}
                title="Show recent actions"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </button>
            )}
          </div>
          
          {showHistory && actionHistory.length > 0 && (
            <div className="bg-gray-50 rounded-md p-2 mb-1 max-h-36 overflow-y-auto border border-gray-100">
              <p className="text-xs text-gray-500 mb-2 px-1 font-medium">Recent actions:</p>
              {actionHistory.map((item, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    handlePopupEvent(e);
                    applyHistoricalAction(item);
                  }}
                  className={`w-full text-left mb-1.5 p-1.5 rounded-md text-xs ${getActionColor(item.action)} text-white flex justify-between items-center shadow-sm`}
                >
                  <span className="font-medium">{getActionLabel(item.action)}</span>
                  {item.instructions && (
                    <span className="truncate max-w-[120px] text-white/80 text-[10px]">
                      {item.instructions}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          
            <input
              type="text"
              placeholder="Additional instructions (optional)"
              value={additionalInstructions}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onClick={handleInputClick}
            onMouseDown={(e) => {
              e.stopPropagation();
              // Don't prevent default to allow focus
              if (e.nativeEvent) {
                e.nativeEvent.stopImmediatePropagation?.();
                e.nativeEvent.stopPropagation?.();
              }
              console.log('Input field mousedown intercepted');
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            disabled={isLoading || isOverTokenLimit}
          />
        </div>
      </div>
    </div>
  );
};

export default TextSelectionPopup; 