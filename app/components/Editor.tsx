"use client";

import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import Placeholder from '@tiptap/extension-placeholder';
import EditorMenuBar from './EditorMenuBar';
import TextSelectionPopup from './TextSelectionPopup';
import EditHistoryViewer from './EditHistoryViewer';

const Editor = () => {
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionCoords, setSelectionCoords] = useState<{ x: number, y: number } | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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
    ],
    content: '<p></p>',
    immediatelyRender: false,
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
      },
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      
      // Only show popup if text is actually selected
      if (from !== to) {
        const selectedText = editor.state.doc.textBetween(from, to, ' ');
        setSelectedText(selectedText);
        
        // Get coordinates for the popup
        const domSelection = window.getSelection();
        if (domSelection && domSelection.rangeCount > 0) {
          const range = domSelection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setSelectionCoords({
            x: rect.left + rect.width / 2,
            y: rect.top - 10
          });
        }
      } else {
        // No text selected, hide popup
        setSelectedText('');
        setSelectionCoords(null);
      }
    },
    onUpdate: ({ editor }) => {
      // This is where we'd log changes to the history file
      console.log('Content updated:', editor.getHTML());
    },
  });

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  return (
    <div className="editor-container relative">
      <div className="flex justify-between items-center mb-2">
        <EditorMenuBar editor={editor} />
        <button
          onClick={() => setIsHistoryOpen(true)}
          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm border flex items-center gap-1"
          title="View edit history"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          History
        </button>
      </div>
      
      <div className="border rounded-md overflow-hidden transition-all">
        <EditorContent editor={editor} />
      </div>
      
      {selectedText && selectionCoords && (
        <TextSelectionPopup 
          text={selectedText} 
          position={selectionCoords} 
          editor={editor}
        />
      )}
      
      {isHistoryOpen && <EditHistoryViewer onClose={() => setIsHistoryOpen(false)} />}
    </div>
  );
};

export default Editor; 