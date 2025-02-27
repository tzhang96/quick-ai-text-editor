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
  const lastTouchEnd = useRef(0);
  const lastMouseUpTime = useRef(0);
  const selectionCheckTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  
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
        return;
      }
      
      // Check if we're clicking inside the popup
      if (popupElement && popupElement.contains(document.activeElement)) {
        return;
      }
      
      onShowPopup(false);
      clearAllHighlights(editor);
      return;
    }
    
    // Determine if we should show the popup
    const shouldShowPopup = isValidSelectionForPopup(editor);
    
    if (shouldShowPopup) {
      // Only check for active selection to prevent flicker
      if (isSelecting.current) {
        return;
      }
      
      // Get selection coordinates
      const rect = getSelectionRect();
      if (!rect || rect.width === 0 || rect.height === 0) {
        return;
      }
      
      onShowPopup(true);
    } else {
      onShowPopup(false);
      clearAllHighlights(editor);
    }
  }, [editor, onShowPopup]);
  
  // Handle touch start
  const handleTouchStart = useCallback((e: Event) => {
    if (!editor) return;
    
    const touchEvent = e as TouchEvent;
    isSelecting.current = true;
    touchStartPos.current = {
      x: touchEvent.touches[0].clientX,
      y: touchEvent.touches[0].clientY
    };
  }, [editor]);
  
  // Handle touch end
  const handleTouchEnd = useCallback((_e: Event) => {
    if (!editor) return;
    
    const now = Date.now();
    lastTouchEnd.current = now;
    isSelecting.current = false;
    
    // Add a small delay to allow the selection to settle
    setTimeout(() => {
      if (Date.now() - now < 300) return; // Ignore if another touch end happened
      checkSelectionForPopup();
    }, 300);
  }, [editor, checkSelectionForPopup]);
  
  // Handle touch move
  const handleTouchMove = useCallback((e: Event) => {
    if (!editor || !touchStartPos.current) return;
    
    const touchEvent = e as TouchEvent;
    const touch = touchEvent.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
    
    // If the user has moved their finger more than a small threshold,
    // consider it a selection attempt rather than a tap
    if (deltaX > 10 || deltaY > 10) {
      isSelecting.current = true;
    }
  }, [editor]);
  
  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!editor) return;
    
    const popupElement = document.querySelector('.text-selection-popup');
    if (popupElement && popupElement.contains(e.target as Node)) {
      e.stopPropagation();
      
      const target = e.target as HTMLElement;
      if (target.tagName.toLowerCase() === 'input') {
        return;
      }
      
      if ('preventDefault' in e) {
        e.preventDefault();
      }
      
      if (e instanceof MouseEvent && e.stopImmediatePropagation) {
        e.stopImmediatePropagation();
      }
      
      return;
    }
    
    isSelecting.current = true;
  }, [editor]);
  
  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (!editor) return;
    
    lastMouseUpTime.current = Date.now();
    isSelecting.current = false;
    checkSelectionForPopup();
  }, [editor, checkSelectionForPopup]);
  
  // Handle selection change
  const handleSelectionChange = useCallback(() => {
    if (!editor) return;
    
    // If actively selecting, wait a tiny bit
    if (isSelecting.current) {
      selectionCheckTimer.current = setTimeout(() => {
        checkSelectionForPopup();
      }, 20);
      return;
    }
    
    // If not actively selecting, check immediately
    checkSelectionForPopup();
  }, [editor, checkSelectionForPopup]);
  
  // Handle drag events
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement> | DragEvent) => {
    if (!editor) return;
    
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    isDragging.current = true;
    onShowPopup(false);
  }, [editor, onShowPopup]);
  
  const handleDragEnd = useCallback((e: React.DragEvent<HTMLDivElement> | DragEvent) => {
    if (!editor) return;
    
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    isDragging.current = false;
    setTimeout(() => {
      checkSelectionForPopup();
    }, 30);
  }, [editor, checkSelectionForPopup]);
  
  // Set up event listeners
  useEffect(() => {
    const editorElement = document.querySelector('.ProseMirror');
    if (!editorElement) return;
    
    // Add touch event listeners
    editorElement.addEventListener('touchstart', handleTouchStart as EventListener);
    editorElement.addEventListener('touchend', handleTouchEnd as EventListener);
    editorElement.addEventListener('touchmove', handleTouchMove as EventListener);
    
    return () => {
      editorElement.removeEventListener('touchstart', handleTouchStart as EventListener);
      editorElement.removeEventListener('touchend', handleTouchEnd as EventListener);
      editorElement.removeEventListener('touchmove', handleTouchMove as EventListener);
    };
  }, [handleTouchStart, handleTouchEnd, handleTouchMove]);
  
  return {
    selectionRange,
    isSelecting,
    isDragging,
    handleMouseDown,
    handleMouseUp,
    handleDragStart,
    handleDragEnd,
    handleSelectionChange,
    handleTouchStart,
    handleTouchEnd,
    handleTouchMove
  };
}; 