"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { transformText, logEditHistory, AIAction, GeminiModel, DEFAULT_MODEL } from '../services/geminiService';

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
};

const TextSelectionPopup: React.FC<TextSelectionPopupProps> = ({
  text,
  position,
  editor,
  className = '',
  actionHistory = [],
  onActionPerformed,
  modelName = DEFAULT_MODEL,
}) => {
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Log props for debugging in production
  useEffect(() => {
    console.log('TextSelectionPopup props:', {
      hasText: !!text,
      textLength: text?.length || 0,
      position,
      editorExists: !!editor,
      modelName
    });
  }, [text, position, editor, modelName]);

  // Make popup appear immediately
  useEffect(() => {
    // Set visible immediately
    setIsVisible(true);
    
    return () => {
      // No cleanup needed
    };
  }, []);

  // Position the popup and ensure it's within viewport
  useEffect(() => {
    const popup = popupRef.current;
    if (!popup) return;

    console.log('Positioning popup, raw position:', position);

    try {
      // Start with the initial position
      let finalX = position.x || 0; // Fallback to 0 if undefined
      let finalY = position.y || 0; // Fallback to 0 if undefined

      // Get popup dimensions
      const rect = popup.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Fallback positioning if we don't have valid coordinates
      if (!position.x && !position.y) {
        console.warn('Invalid position coordinates, using fallback positioning');
        // Try to position near the editor
        const editorElement = document.querySelector('.ProseMirror');
        if (editorElement) {
          const editorRect = editorElement.getBoundingClientRect();
          finalX = editorRect.left + 50;
          finalY = editorRect.top + 50;
        } else {
          // Centered fallback if editor not found
          finalX = viewportWidth / 2 - rect.width / 2;
          finalY = viewportHeight / 3; // Position in top third
        }
      }
      
      // Check selection element position in editor
      const selection = window.getSelection();
      const editorElement = document.querySelector('.ProseMirror');
      const editorRect = editorElement?.getBoundingClientRect();
      
      if (selection && selection.rangeCount > 0 && editorRect) {
        try {
          const range = selection.getRangeAt(0);
          const selectionRect = range.getBoundingClientRect();
          
          console.log('Selection rect:', {
            top: selectionRect.top,
            bottom: selectionRect.bottom,
            left: selectionRect.left,
            right: selectionRect.right,
            width: selectionRect.width,
            height: selectionRect.height
          });
          
          // Only use selection rect if it seems valid
          if (selectionRect.width > 0 && selectionRect.height > 0) {
            // Determine if we have more space above or below the selection
            const spaceAbove = selectionRect.top - editorRect.top;
            const spaceBelow = editorRect.bottom - selectionRect.bottom;
            
            // Position based on available space
            if (spaceBelow >= rect.height + 20) {
              // Default: Position below selection with enough space
              finalY = selectionRect.bottom + 10;
              finalX = selectionRect.left + (selectionRect.width / 2) - (rect.width / 2);
            } else if (spaceAbove >= rect.height + 20) {
              // Position above selection if more space available
              finalY = selectionRect.top - rect.height - 10;
              finalX = selectionRect.left + (selectionRect.width / 2) - (rect.width / 2);
            } else {
              // Position to the side if neither above nor below has enough space
              finalY = Math.min(
                Math.max(editorRect.top + 10, selectionRect.top), 
                editorRect.bottom - rect.height - 10
              );
              
              // Prefer right side positioning if possible
              if (selectionRect.right + rect.width + 20 < viewportWidth) {
                finalX = selectionRect.right + 20;
              } else if (selectionRect.left - rect.width - 20 > 0) {
                finalX = selectionRect.left - rect.width - 20;
              } else {
                // Center horizontally if side positioning doesn't work
                finalX = viewportWidth / 2 - rect.width / 2;
              }
            }
          } else {
            console.warn('Invalid selection rectangle, using original position');
          }
        } catch (error) {
          console.error('Error calculating position from selection:', error);
        }
      } else {
        console.log('Unable to find selection or editor element, using default position');
      }

      // Final boundary checks to ensure popup stays within viewport
      if (finalX + rect.width > viewportWidth) {
        finalX = viewportWidth - rect.width - 10;
      }
      if (finalX < 10) {
        finalX = 10;
      }
      if (finalY + rect.height > viewportHeight) {
        finalY = viewportHeight - rect.height - 10;
      }
      if (finalY < 10) {
        finalY = 10;
      }

      // Apply position with added z-index to ensure it's on top
      console.log('Final popup position:', { finalX, finalY });
      popup.style.transform = `translate(${finalX}px, ${finalY}px)`;
      popup.style.zIndex = '9999'; // Ensure high z-index
    } catch (error) {
      console.error('Error positioning popup:', error);
      // Apply emergency fallback position
      popup.style.transform = 'translate(10px, 10px)';
    }
  }, [position]);

  const handleAIAction = async (action: AIAction) => {
    setIsLoading(true);
    
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
        
        // Update persistent highlight to cover the new content
        const extensionStorage = editor.extensionManager.extensions.find(
          ext => ext.name === 'persistentHighlight'
        )?.storage;
        
        if (extensionStorage && extensionStorage.highlights) {
          // Update the highlight to match the new selection
          if (extensionStorage.highlights.length > 0) {
            extensionStorage.highlights[0].from = newFrom;
            extensionStorage.highlights[0].to = newTo;
            editor.view.dispatch(editor.state.tr); // Force redraw
          }
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
          onActionPerformed(action, additionalInstructions, modelName);
        }
      } else {
        console.error('Transformation failed: Empty result');
        alert('Error: Failed to transform text');
      }
    } catch (error) {
      console.error('Error during text transformation:', error);
      alert('Failed to process text. Please try again.');
    } finally {
      setIsLoading(false);
      setShowHistory(false);
      // Close popup after action completes
      setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => {
          // Allow animation to complete before unmounting
          if (onActionPerformed) {
            onActionPerformed('' as AIAction, '', modelName); // Signal to close popup
          }
        }, 200);
      }, 500);
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

  return (
    <div
      ref={popupRef}
      className={`fixed top-0 left-0 z-50 ${isVisible ? 'opacity-100' : 'opacity-0'} ${className}`}
      style={{ 
        transform: `translate(${position.x}px, ${position.y}px)`,
        transformOrigin: 'top center',
        transition: 'opacity 50ms ease', // Only fade opacity, no movement animation
        pointerEvents: 'none' // Prevent mouse events on the container to fix flickering
      }}
    >
      <div 
        className="bg-white shadow-lg rounded-lg border border-gray-200 overflow-hidden w-64"
        style={{ pointerEvents: 'auto' }} // Re-enable pointer events for the content
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleAIAction('expand')}
              className="bg-indigo-500 text-white px-2.5 py-1.5 rounded-md text-sm font-medium hover:bg-indigo-600 shadow-sm transition-colors"
              disabled={isLoading}
            >
              Expand
            </button>
            <button
              onClick={() => handleAIAction('summarize')}
              className="bg-green-500 text-white px-2.5 py-1.5 rounded-md text-sm font-medium hover:bg-green-600 shadow-sm transition-colors"
              disabled={isLoading}
            >
              Summarize
            </button>
            <button
              onClick={() => handleAIAction('rephrase')}
              className="bg-yellow-500 text-white px-2.5 py-1.5 rounded-md text-sm font-medium hover:bg-yellow-600 shadow-sm transition-colors"
              disabled={isLoading}
            >
              Rephrase
            </button>
            <button
              onClick={() => handleAIAction('revise')}
              className="bg-purple-500 text-white px-2.5 py-1.5 rounded-md text-sm font-medium hover:bg-purple-600 shadow-sm transition-colors"
              disabled={isLoading}
            >
              Revise
            </button>
            
            {actionHistory.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
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
                  onClick={() => applyHistoricalAction(item)}
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
          
          <div className="relative">
            <input
              type="text"
              placeholder="Additional instructions (optional)"
              value={additionalInstructions}
              onChange={(e) => setAdditionalInstructions(e.target.value)}
              className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300 shadow-sm"
              disabled={isLoading}
            />
            {isLoading && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-md backdrop-blur-[1px]">
                <div className="h-5 w-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextSelectionPopup; 