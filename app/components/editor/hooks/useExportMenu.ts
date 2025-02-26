import { useCallback, useState } from 'react';
import { Editor } from '@tiptap/react';

interface UseExportMenuProps {
  editor: Editor | null;
}

export const useExportMenu = ({ editor }: UseExportMenuProps) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Toggle the export menu
  const toggleExportMenu = useCallback(() => {
    setShowExportMenu((prev) => !prev);
  }, []);
  
  // Close the export menu
  const closeExportMenu = useCallback(() => {
    setShowExportMenu(false);
  }, []);
  
  // Export as HTML
  const exportAsHTML = useCallback(() => {
    if (!editor) return;
    
    const content = editor.getHTML();
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.html';
    a.click();
    
    URL.revokeObjectURL(url);
    closeExportMenu();
  }, [editor, closeExportMenu]);
  
  // Export as Markdown
  const exportAsMarkdown = useCallback(() => {
    if (!editor) return;
    
    const content = editor.storage.markdown?.getMarkdown() || '';
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.md';
    a.click();
    
    URL.revokeObjectURL(url);
    closeExportMenu();
  }, [editor, closeExportMenu]);
  
  // Export as plain text
  const exportAsText = useCallback(() => {
    if (!editor) return;
    
    const content = editor.getText();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.txt';
    a.click();
    
    URL.revokeObjectURL(url);
    closeExportMenu();
  }, [editor, closeExportMenu]);
  
  return {
    showExportMenu,
    toggleExportMenu,
    closeExportMenu,
    exportAsHTML,
    exportAsMarkdown,
    exportAsText
  };
}; 