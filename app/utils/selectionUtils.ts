import { Editor } from '@tiptap/react';

/**
 * Gets the current selection range from the editor
 */
export const getSelectionRange = (editor: Editor): { from: number; to: number } | null => {
  if (!editor || !editor.state.selection) return null;
  
  const { from, to } = editor.state.selection;
  if (from === to) return null; // No selection
  
  return { from, to };
};

/**
 * Gets the selected text from the editor
 */
export const getSelectedText = (editor: Editor): string => {
  if (!editor) return '';
  
  const range = getSelectionRange(editor);
  if (!range) return '';
  
  return editor.state.doc.textBetween(range.from, range.to);
};

/**
 * Calculates the selection rectangle in the editor
 */
export const getSelectionRect = (): DOMRect | null => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  
  const range = selection.getRangeAt(0);
  if (!range) return null;
  
  return range.getBoundingClientRect();
};

/**
 * Checks if the current selection is valid for showing a popup
 */
export const isValidSelectionForPopup = (editor: Editor): boolean => {
  if (!editor) return false;
  
  const range = getSelectionRange(editor);
  if (!range) return false;
  
  const selectedText = getSelectedText(editor);
  return selectedText.trim().length > 0;
}; 