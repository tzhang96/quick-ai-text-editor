import { useCallback, useEffect, useState } from 'react';
import { Editor, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import PersistentHighlight from '../extensions/PersistentHighlight';

interface UseEditorInitializationProps {
  initialContent?: string;
  onUpdate?: (editor: Editor) => void;
  placeholder?: string;
  isMonospaceFont?: boolean;
}

export const useEditorInitialization = ({
  initialContent = '',
  onUpdate,
  placeholder = 'Start typing or paste text here...',
  isMonospaceFont = false
}: UseEditorInitializationProps) => {
  const [isEditorReady, setIsEditorReady] = useState(false);
  
  // Initialize the editor with extensions
  const editor = useEditor({
    extensions: [
      // Use StarterKit which includes most basic extensions
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {},
        orderedList: {},
        codeBlock: {},
        blockquote: {},
        bold: {},
        italic: {},
        strike: {},
        code: {},
        history: {},
      }),
      // Add Underline extension
      Underline,
      Placeholder.configure({
        placeholder,
      }),
      PersistentHighlight.configure({
        highlightClass: 'highlight-yellow',
      }),
    ],
    content: initialContent,
    autofocus: 'end',
    onUpdate: ({ editor }) => {
      onUpdate?.(editor);
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm focus:outline-none min-h-[300px] max-w-none ${isMonospaceFont ? 'font-mono' : ''}`,
      },
      // Handle paste to strip unwanted formatting
      handlePaste: (view, event) => {
        if (event.clipboardData && event.clipboardData.getData('text/plain')) {
          // Let built-in handlers deal with it
          return false;
        }
        return false;
      },
    },
    immediatelyRender: false, // Fix for SSR hydration issues
  });
  
  // Set editor ready state when editor is initialized
  useEffect(() => {
    if (editor) {
      setIsEditorReady(true);
      
      // Log initial state
      console.log('Editor initialized with extensions:', 
        editor.extensionManager.extensions.map(ext => ext.name).join(', '));
    }
  }, [editor]);
  
  // Get the editor content
  const getContent = useCallback(() => {
    if (!editor) return '';
    return editor.getHTML();
  }, [editor]);
  
  // Set the editor content
  const setContent = useCallback((content: string) => {
    if (!editor) return;
    editor.commands.setContent(content);
  }, [editor]);
  
  return {
    editor,
    isEditorReady,
    getContent,
    setContent
  };
}; 