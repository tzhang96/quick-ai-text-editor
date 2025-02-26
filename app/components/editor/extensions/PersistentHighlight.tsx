"use client";

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

// Interface for highlight objects
export interface Highlight {
  from: number;
  to: number;
  class: string;
}

// Declare the commands interface to extend Tiptap's command types
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    persistentHighlight: {
      /**
       * Add a highlight to the document
       */
      addHighlight: (highlight: Highlight) => ReturnType;
      /**
       * Remove a highlight at the specified index
       */
      removeHighlight: (highlightIndex: number) => ReturnType;
      /**
       * Clear all highlights
       */
      clearHighlights: () => ReturnType;
    };
  }
}

// Create the PersistentHighlight extension
const PersistentHighlight = Extension.create({
  name: 'persistentHighlight',

  addOptions() {
    return {
      highlightClass: 'highlight-yellow',
    };
  },

  addStorage() {
    return {
      highlights: [] as Highlight[],
    };
  },

  addCommands() {
    return {
      addHighlight: (highlight: Highlight) => ({ tr, dispatch }) => {
        // Add the highlight to storage
        this.storage.highlights = [...this.storage.highlights, highlight];
        
        // Force a redraw if dispatch is available
        if (dispatch) {
          dispatch(tr);
        }
        
        return true;
      },
      
      removeHighlight: (highlightIndex: number) => ({ tr, dispatch }) => {
        // Remove the highlight at the specified index
        this.storage.highlights = this.storage.highlights.filter(
          (_highlight: Highlight, index: number) => index !== highlightIndex
        );
        
        // Force a redraw if dispatch is available
        if (dispatch) {
          dispatch(tr);
        }
        
        return true;
      },
      
      clearHighlights: () => ({ tr, dispatch }) => {
        // Clear all highlights
        this.storage.highlights = [];
        
        // Force a redraw if dispatch is available
        if (dispatch) {
          dispatch(tr);
        }
        
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const { highlightClass } = this.options;
    
    return [
      new Plugin({
        key: new PluginKey('persistentHighlight'),
        props: {
          decorations: (state) => {
            const { doc } = state;
            const decorations: Decoration[] = [];
            
            // Apply all stored highlights as decorations
            this.storage.highlights.forEach((highlight: Highlight) => {
              const from = highlight.from;
              const to = highlight.to;
              
              if (from === to) return;
              
              decorations.push(
                Decoration.inline(from, to, {
                  class: highlight.class || highlightClass,
                })
              );
            });
            
            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

export default PersistentHighlight; 