import { useCallback, useEffect, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { getSelectionRange, isValidSelectionForPopup, getSelectionRect } from '../../../utils/selectionUtils';
import { clearAllHighlights } from '../../../utils/highlightUtils';

interface UseSelectionHandlingProps {
  editor: Editor | null;
  onShowPopup: (shouldShow: boolean) => void;
}

export const useSelectionHandling = ({ editor, onShowPopup }: UseSelectionHandlingProps) => {
  const [selectionRange, setSelectionRange] = useState<{ from: number; to: number } | null>(null);
  const isSelecting = useRef(false);
  const isDragging = useRef(false);
  const lastMouseUpTime = useRef(0);
  const selectionCheckTimer = useRef<NodeJS.Timeout | null>(null);
  const selectionEndTimeout = useRef<NodeJS.Timeout | null>(null);
  const popupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Create a function to check if selection should show popup
  const checkSelectionForPopup = useCallback(() => {
    if (!editor) return;
    
    // Clear any pending timer
    if (selectionCheckTimer.current) {
      clearTimeout(selectionCheckTimer.current);
      selectionCheckTimer.current = null;
    }
    
    // Get the current selection range
    const range = getSelectionRange(editor);
    setSelectionRange(range);
    
    // Check if the selection is valid
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !range) {
      // Before hiding the popup, check if we're interacting with the popup input
      const activeElement = document.activeElement;
      const popupElement = document.querySelector('.text-selection-popup');
      
      if (popupElement && activeElement && popupElement.contains(activeElement)) {
        console.log('Input field interaction detected - keeping popup open');
        return;
      }
      
      // Check if we're clicking inside the popup (not just the input)
      if (popupElement && popupElement.contains(document.activeElement)) {
        console.log('Popup interaction detected - keeping popup open');
        return;
      }
      
      // If we get here, we're not interacting with the popup, so we can close it
      // and clear the highlights
      console.log('No valid selection and no popup interaction - clearing highlights');
      const currentPopupTimeout = setTimeout(() => {
        onShowPopup(false);
        clearAllHighlights(editor);
      }, 300);
      popupTimeoutRef.current = currentPopupTimeout;
      return;
    }
    
    // Determine if we should show the popup
    const shouldShowPopup = isValidSelectionForPopup(editor);
    
    if (shouldShowPopup) {
      console.log('Valid selection detected, showing popup');
      
      // The key improvement: Only show popup after selection has "settled"
      // This prevents flickering during active selection
      if (isSelecting.current || isDragging.current) {
        console.log('Still selecting - not showing popup yet');
        return;
      }
      
      // Get selection coordinates
      const rect = getSelectionRect();
      if (!rect || rect.width === 0 || rect.height === 0) {
        console.log('Invalid selection rectangle, not showing popup');
        return;
      }
      
      // Show popup with a small delay to ensure selection is stable
      const currentSelectionEndTimeout = setTimeout(() => {
        onShowPopup(true);
      }, 100);
      selectionEndTimeout.current = currentSelectionEndTimeout;
    } else {
      onShowPopup(false);
      clearAllHighlights(editor);
    }
  }, [editor, onShowPopup]);
  
  // Handle selection change
  const handleSelectionChange = useCallback(() => {
    if (!editor) return;
    
    // If we're actively selecting or dragging, don't check yet
    if (isSelecting.current || isDragging.current) {
      console.log('Active selection/drag in progress, deferring popup check');
      return;
    }
    
    // Clear any pending timer
    if (selectionCheckTimer.current) {
      clearTimeout(selectionCheckTimer.current);
    }
    
    // Set a new timer to check selection after a short delay
    selectionCheckTimer.current = setTimeout(() => {
      checkSelectionForPopup();
    }, 150); // Increased delay for better stability
  }, [editor, checkSelectionForPopup]);
  
  // Handle mouse down event - only used to track the start of selection
  const handleMouseDown = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!editor) return;
    
    // Check if clicking inside popup - if so, don't start selection
    const popupElement = document.querySelector('.text-selection-popup');
    if (popupElement && popupElement.contains(e.target as Node)) {
      // Don't start selection when clicking in popup
      console.log('Clicked inside popup - not starting selection');
      e.stopPropagation();
      
      // Check if clicking on an input field
      const target = e.target as HTMLElement;
      if (target.tagName.toLowerCase() === 'input') {
        console.log('Clicked on input field - allowing default behavior');
        // Let the input field handle the click, but prevent selection
        isSelecting.current = false;
        return;
      }
      
      // Prevent any default behavior for non-input elements
      if ('preventDefault' in e) {
        e.preventDefault();
      }
      
      // Prevent the event from bubbling up
      if (e instanceof MouseEvent && e.stopImmediatePropagation) {
        e.stopImmediatePropagation();
      }
      
      return;
    }
    
    isSelecting.current = true;
    console.log('Mouse down - selection started');
    
    // Get the target from the event
    const target = e.target as HTMLElement;
    
    // Check if clicking on highlighted text
    const highlightElement = target.closest('.highlight-yellow');
    if (highlightElement) {
      // Don't clear the selection and highlight immediately
      // This allows the popup to remain visible when clicking on highlighted text
      e.stopPropagation();
      
      // Set a timeout to allow the browser to process the click
      setTimeout(() => {
        isSelecting.current = false;
      }, 50);
      
      return;
    }
  }, [editor]);
  
  // Handle mouse up event
  const handleMouseUp = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!editor) return;
    
    lastMouseUpTime.current = Date.now();
    console.log('Mouse up - selection ended');
    
    // Mark selection as completed
    isSelecting.current = false;
    
    // Use a timeout to ensure selection is stable before checking
    setTimeout(() => {
      checkSelectionForPopup();
    }, 150); // Increased delay for better stability
  }, [editor, checkSelectionForPopup]);
  
  // Handle drag start event
  const handleDragStart = useCallback((e: React.DragEvent | DragEvent) => {
    if (!editor) return;
    
    isDragging.current = true;
    console.log('Drag started');
    
    // Hide popup during drag operations
    onShowPopup(false);
  }, [editor, onShowPopup]);
  
  // Handle drag end event
  const handleDragEnd = useCallback((e: React.DragEvent | DragEvent) => {
    if (!editor) return;
    
    lastMouseUpTime.current = Date.now();
    isDragging.current = false;
    console.log('Drag ended');
    
    // Use a timeout to ensure selection is stable
    setTimeout(() => {
      checkSelectionForPopup();
    }, 200); // Longer delay after drag operations
  }, [editor, checkSelectionForPopup]);
  
  // Subscribe to document selection changes
  useEffect(() => {
    const onSelectionChange = () => {
      // Skip if we're in the middle of selecting
      if (isSelecting.current || isDragging.current) {
        console.log('Selection changing - waiting to complete');
        return;
      }
      
      // Skip if the last mouse up was very recent
      const timeSinceMouseUp = Date.now() - lastMouseUpTime.current;
      if (timeSinceMouseUp < 100) {
        console.log('Recent mouse up, waiting for selection to settle');
        return;
      }
      
      // Check the selection
      handleSelectionChange();
    };
    
    // Add document-level event listeners
    const handleDocumentMouseUp = (e: MouseEvent) => {
      handleMouseUp(e);
    };
    
    const handleDocumentDragEnd = (e: DragEvent) => {
      handleDragEnd(e);
    };
    
    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('mouseup', handleDocumentMouseUp);
    document.addEventListener('dragend', handleDocumentDragEnd);
    
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
      document.removeEventListener('dragend', handleDocumentDragEnd);
      
      // Clean up any pending timers
      if (selectionCheckTimer.current) {
        clearTimeout(selectionCheckTimer.current);
      }
      if (selectionEndTimeout.current) {
        clearTimeout(selectionEndTimeout.current);
      }
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, [handleSelectionChange, handleMouseUp, handleDragEnd]);
  
  // Add a keyboard shortcut handler for Ctrl+Shift+P to force show popup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'p' && editor) {
        e.preventDefault();
        console.log('Keyboard shortcut Ctrl+Shift+P detected');
        
        const range = getSelectionRange(editor);
        if (range) {
          setSelectionRange(range);
          onShowPopup(true);
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor, onShowPopup]);
  
  return {
    selectionRange,
    isSelecting,
    isDragging,
    handleMouseDown,
    handleMouseUp,
    handleDragStart,
    handleDragEnd,
    handleSelectionChange
  };
}; 