import { Editor } from '@tiptap/react';
import { Highlight } from '../components/editor/extensions/PersistentHighlight';

/**
 * Adds a highlight to the editor at the specified range
 */
export const addHighlight = (
  editor: Editor,
  from: number,
  to: number,
  highlightClass: string = 'highlight-yellow'
): void => {
  if (!editor || from === to) return;
  
  // Get the extension
  const extension = editor.extensionManager.extensions.find(
    (ext) => ext.name === 'persistentHighlight'
  );
  
  if (!extension) {
    console.error('PersistentHighlight extension not found');
    return;
  }
  
  // Add the highlight to storage
  const highlights = [...extension.storage.highlights, { from, to, class: highlightClass }];
  extension.storage.highlights = highlights;
  
  // Force a redraw
  editor.view.dispatch(editor.state.tr);
  
  console.log('Highlight added:', { from, to, class: highlightClass });
};

/**
 * Highlights the current selection in the editor
 */
export const highlightSelection = (
  editor: Editor,
  highlightClass: string = 'highlight-yellow'
): void => {
  if (!editor) return;
  
  const { from, to } = editor.state.selection;
  if (from === to) return; // No selection
  
  addHighlight(editor, from, to, highlightClass);
};

/**
 * Clears all highlights from the editor
 */
export const clearAllHighlights = (editor: Editor): void => {
  if (!editor) return;
  
  // Get the extension
  const extension = editor.extensionManager.extensions.find(
    (ext) => ext.name === 'persistentHighlight'
  );
  
  if (!extension) return;
  
  // Clear all highlights
  extension.storage.highlights = [];
  
  // Force a redraw
  editor.view.dispatch(editor.state.tr);
};

/**
 * Gets all current highlights from the editor
 */
export const getHighlights = (editor: Editor): Highlight[] => {
  if (!editor) return [];
  
  const extension = editor.extensionManager.extensions.find(
    (extension) => extension.name === 'persistentHighlight'
  );
  
  if (!extension) return [];
  
  return extension.storage.highlights || [];
};

/**
 * Sets highlights in the editor
 */
export const setHighlights = (editor: Editor, highlights: Highlight[]): void => {
  if (!editor) return;
  
  const extension = editor.extensionManager.extensions.find(
    (extension) => extension.name === 'persistentHighlight'
  );
  
  if (!extension) return;
  
  extension.storage.highlights = highlights;
  editor.view.dispatch(editor.state.tr);
}; 