import { useCallback, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { TextChangeTracker } from '../../../types/editor.types';

interface UseTextChangeTrackingProps {
  editor: Editor | null;
  onContentChange?: (content: string) => void;
  debounceTime?: number;
}

export const useTextChangeTracking = ({
  editor,
  onContentChange,
  debounceTime = 500
}: UseTextChangeTrackingProps) => {
  // Reference to track text changes
  const textChangeTracker = useRef<TextChangeTracker>({
    previousContent: '',
    changeTimer: null,
    isTracking: false,
    ignoreNextChange: false,
  });
  
  // Start tracking text changes
  const startTracking = useCallback(() => {
    if (!editor) return;
    
    textChangeTracker.current.isTracking = true;
    textChangeTracker.current.previousContent = editor.getHTML();
  }, [editor]);
  
  // Stop tracking text changes
  const stopTracking = useCallback(() => {
    textChangeTracker.current.isTracking = false;
    
    // Clear any pending timers
    if (textChangeTracker.current.changeTimer) {
      clearTimeout(textChangeTracker.current.changeTimer);
      textChangeTracker.current.changeTimer = null;
    }
  }, []);
  
  // Ignore the next change (useful after AI actions)
  const ignoreNextChange = useCallback(() => {
    textChangeTracker.current.ignoreNextChange = true;
  }, []);
  
  // Handle content updates
  useEffect(() => {
    if (!editor || !onContentChange) return;
    
    // Create a reference to the current tracker for use in cleanup
    const currentTracker = textChangeTracker.current;
    
    // Function to handle editor updates
    const handleUpdate = ({ editor }: { editor: Editor }) => {
      const currentContent = editor.getHTML();
      
      // Check if we should ignore this change
      if (currentTracker.ignoreNextChange) {
        currentTracker.ignoreNextChange = false;
        currentTracker.previousContent = currentContent;
        return;
      }
      
      // Only track changes if tracking is enabled
      if (!currentTracker.isTracking) return;
      
      // Clear any existing timer
      if (currentTracker.changeTimer) {
        clearTimeout(currentTracker.changeTimer);
      }
      
      // Set a new timer to debounce the change notification
      currentTracker.changeTimer = setTimeout(() => {
        // Only notify if content has actually changed
        if (currentContent !== currentTracker.previousContent) {
          onContentChange(currentContent);
          currentTracker.previousContent = currentContent;
        }
      }, debounceTime);
    };
    
    // Subscribe to editor updates
    editor.on('update', handleUpdate);
    
    // Cleanup on unmount
    return () => {
      editor.off('update', handleUpdate);
      if (currentTracker.changeTimer) {
        clearTimeout(currentTracker.changeTimer);
      }
    };
  }, [editor, onContentChange, debounceTime]);
  
  return {
    startTracking,
    stopTracking,
    ignoreNextChange
  };
}; 