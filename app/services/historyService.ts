"use client";

import { AIAction, GeminiModel } from './geminiService';

// Define the interface for an edit event
export interface EditEvent {
  timestamp: string;
  action: string; // "AI_EXPAND", "AI_SUMMARIZE", "MANUAL_EDIT", etc.
  originalText: string;
  newText: string;
  additionalInstructions?: string;
  modelName?: GeminiModel; // Add model information
}

// We need different implementations for client and server
const isClient = typeof window !== 'undefined';

// Client-side implementation using localStorage
export const getEditHistory = async (): Promise<EditEvent[]> => {
  if (isClient) {
    try {
      const historyString = localStorage.getItem('editHistory');
      return historyString ? JSON.parse(historyString) : [];
    } catch (error) {
      console.error('Error reading edit history:', error);
      return [];
    }
  } else {
    // Server-side implementation would use the file system
    // but this should never be called directly from client components
    console.warn('Attempted to get edit history on the server');
    return [];
  }
};

// Add a new edit event to the history
export const addEditEvent = async (event: EditEvent): Promise<void> => {
  if (isClient) {
    try {
      // Get current history from localStorage
      const history = await getEditHistory();
      
      // Add new event
      history.push(event);
      
      // Write updated history back to localStorage
      localStorage.setItem('editHistory', JSON.stringify(history));
      
      // Also log to console for debugging
      console.log('Edit logged:', event);
    } catch (error) {
      console.error('Error logging edit event:', error);
    }
  } else {
    // Server-side implementation would use the file system
    // but this should never be called directly from client components
    console.warn('Attempted to add edit event on the server');
  }
};

// Format the action name
const formatActionName = (action: string | AIAction): string => {
  if (typeof action === 'string') {
    if (action.startsWith('AI_') || action.startsWith('MANUAL_')) {
      return action;
    }
    return `AI_${action.toUpperCase()}`;
  }
  
  // Handle AIAction enum
  switch (action) {
    case 'expand':
      return 'AI_EXPAND';
    case 'summarize':
      return 'AI_SUMMARIZE';
    case 'rephrase':
      return 'AI_REPHRASE';
    case 'revise':
      return 'AI_REVISE';
    default:
      return `AI_ACTION`;
  }
};

// Create a formatted edit event object
export const createEditEvent = (
  originalText: string,
  newText: string,
  action: string | AIAction,
  additionalInstructions?: string,
  modelName?: GeminiModel
): EditEvent => {
  return {
    timestamp: new Date().toISOString(),
    action: formatActionName(action),
    originalText,
    newText,
    additionalInstructions,
    modelName
  };
}; 