"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { transformText, logEditHistory, AIAction } from '../services/geminiService';

type TextSelectionPopupProps = {
  text: string;
  position: { x: number; y: number };
  editor: Editor;
};

const TextSelectionPopup: React.FC<TextSelectionPopupProps> = ({
  text,
  position,
  editor,
}) => {
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Position the popup and ensure it's within viewport
  useEffect(() => {
    const popup = popupRef.current;
    if (!popup) return;

    // Start with the initial position
    let finalX = position.x;
    let finalY = position.y;

    // Adjust position if popup would go off-screen
    const rect = popup.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (finalX + rect.width / 2 > viewportWidth) {
      finalX = viewportWidth - rect.width / 2;
    }
    if (finalX - rect.width / 2 < 0) {
      finalX = rect.width / 2;
    }
    if (finalY + rect.height > viewportHeight) {
      finalY = position.y - rect.height - 20; // Show above selection
    }

    // Apply position
    popup.style.transform = `translate(${finalX}px, ${finalY}px)`;
  }, [position]);

  // Handle closing when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        // Don't close if the click was on the selected text
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          if (range.toString().trim().length > 0) {
            return;
          }
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleAIAction = async (action: AIAction) => {
    setIsLoading(true);
    
    try {
      // Get the full document content for better context
      const fullDocument = editor.getHTML();
      
      // Use the Gemini API service to transform the text
      const response = await transformText({
        text,
        action,
        additionalInstructions: additionalInstructions || undefined,
        fullDocument // Pass the full document for context
      });
      
      // Replace the selected text with the AI response
      if (response) {
        const { from, to } = editor.state.selection;
        editor.chain().focus().deleteRange({ from, to }).insertContent(response).run();
        
        // Log the edit to history
        logEditHistory(text, response, action, additionalInstructions || undefined);
      }
      
    } catch (error) {
      console.error('Error performing AI action:', error);
      // Show error message to user
      alert(`Error performing ${action}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      ref={popupRef}
      className="fixed top-0 left-0 -translate-x-1/2 z-50"
      style={{ 
        transform: `translate(${position.x}px, ${position.y}px)` 
      }}
    >
      <div className="bg-white shadow-lg rounded-lg border border-gray-200 overflow-hidden w-64">
        <div className="p-2 space-y-2">
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => handleAIAction('expand')}
              className="bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-600"
              disabled={isLoading}
            >
              Expand
            </button>
            <button
              onClick={() => handleAIAction('summarize')}
              className="bg-green-500 text-white px-2 py-1 rounded text-sm hover:bg-green-600"
              disabled={isLoading}
            >
              Summarize
            </button>
            <button
              onClick={() => handleAIAction('rephrase')}
              className="bg-yellow-500 text-white px-2 py-1 rounded text-sm hover:bg-yellow-600"
              disabled={isLoading}
            >
              Rephrase
            </button>
            <button
              onClick={() => handleAIAction('revise')}
              className="bg-purple-500 text-white px-2 py-1 rounded text-sm hover:bg-purple-600"
              disabled={isLoading}
            >
              Revise
            </button>
          </div>
          <input
            type="text"
            placeholder="Additional instructions..."
            value={additionalInstructions}
            onChange={(e) => setAdditionalInstructions(e.target.value)}
            className="w-full p-1 text-sm border rounded"
            disabled={isLoading}
          />
          {isLoading && (
            <div className="text-center py-1 text-sm text-gray-600">
              Processing...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TextSelectionPopup; 