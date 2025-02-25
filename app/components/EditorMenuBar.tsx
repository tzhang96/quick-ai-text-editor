"use client";

import React from 'react';
import { Editor } from '@tiptap/react';

type EditorMenuBarProps = {
  editor: Editor;
};

const EditorMenuBar: React.FC<EditorMenuBarProps> = ({ editor }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="menubar py-2 px-1 flex flex-wrap gap-1 justify-center">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-2 rounded hover:bg-gray-200 transition-colors ${
          editor.isActive('bold') ? 'bg-gray-200 text-gray-900' : 'text-gray-700'
        }`}
        title="Bold (Ctrl+B)"
      >
        <span className="font-bold">B</span>
      </button>

      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-2 rounded hover:bg-gray-200 transition-colors ${
          editor.isActive('italic') ? 'bg-gray-200 text-gray-900' : 'text-gray-700'
        }`}
        title="Italic (Ctrl+I)"
      >
        <span className="italic">I</span>
      </button>

      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`p-2 rounded hover:bg-gray-200 transition-colors ${
          editor.isActive('underline') ? 'bg-gray-200 text-gray-900' : 'text-gray-700'
        }`}
        title="Underline (Ctrl+U)"
      >
        <span className="underline">U</span>
      </button>

      <div className="border-r mx-1 h-6 bg-gray-300"></div>

      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`p-2 rounded hover:bg-gray-200 transition-colors ${
          editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 text-gray-900' : 'text-gray-700'
        }`}
        title="Heading 1 (Ctrl+Alt+1)"
      >
        H1
      </button>

      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`p-2 rounded hover:bg-gray-200 transition-colors ${
          editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 text-gray-900' : 'text-gray-700'
        }`}
        title="Heading 2 (Ctrl+Alt+2)"
      >
        H2
      </button>

      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`p-2 rounded hover:bg-gray-200 transition-colors ${
          editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 text-gray-900' : 'text-gray-700'
        }`}
        title="Heading 3 (Ctrl+Alt+3)"
      >
        H3
      </button>

      <div className="border-r mx-1 h-6 bg-gray-300"></div>

      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-2 rounded hover:bg-gray-200 transition-colors ${
          editor.isActive('bulletList') ? 'bg-gray-200 text-gray-900' : 'text-gray-700'
        }`}
        title="Bullet List (Ctrl+Shift+8)"
      >
        • List
      </button>

      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-2 rounded hover:bg-gray-200 transition-colors ${
          editor.isActive('orderedList') ? 'bg-gray-200 text-gray-900' : 'text-gray-700'
        }`}
        title="Ordered List (Ctrl+Shift+7)"
      >
        1. List
      </button>

      <div className="border-r mx-1 h-6 bg-gray-300"></div>

      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className={`p-2 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:hover:bg-transparent text-gray-700`}
        title="Undo (Ctrl+Z)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
        </svg>
      </button>

      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className={`p-2 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:hover:bg-transparent text-gray-700`}
        title="Redo (Ctrl+Y)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
        </svg>
      </button>
    </div>
  );
};

export default EditorMenuBar; 