import { useCallback, useState, useEffect } from 'react';
import { ActionHistoryItem, MAX_ACTION_HISTORY } from '../../../types/editor.types';
import { AIAction, GeminiModel } from '../../../services/geminiService';

export const useActionHistory = () => {
  const [actionHistory, setActionHistory] = useState<ActionHistoryItem[]>([]);
  
  // Load action history from localStorage on initial render
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('actionHistory');
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory)) {
          setActionHistory(parsedHistory);
          console.log('Loaded action history from localStorage:', parsedHistory.length, 'items');
        }
      }
    } catch (error) {
      console.error('Error loading action history from localStorage:', error);
    }
  }, []);
  
  // Add an action to the history
  const addActionToHistory = useCallback((
    action: AIAction,
    instructions: string,
    modelName: GeminiModel
  ) => {
    // If action is empty, it's a signal to close the popup, not an actual action
    if (!action) {
      console.log('Empty action received, not adding to history');
      return;
    }
    
    console.log('Adding action to history:', action, instructions, modelName);
    
    setActionHistory((prevHistory) => {
      // Create a new history item
      const newItem: ActionHistoryItem = {
        action,
        instructions,
        timestamp: Date.now(),
        modelName,
      };
      
      // Add to the beginning of the array and limit to MAX_ACTION_HISTORY items
      const updatedHistory = [newItem, ...prevHistory];
      const limitedHistory = updatedHistory.length > MAX_ACTION_HISTORY 
        ? updatedHistory.slice(0, MAX_ACTION_HISTORY)
        : updatedHistory;
      
      // Save to localStorage
      try {
        localStorage.setItem('actionHistory', JSON.stringify(limitedHistory));
        console.log('Saved action history to localStorage:', limitedHistory.length, 'items');
      } catch (error) {
        console.error('Error saving action history to localStorage:', error);
      }
      
      return limitedHistory;
    });
  }, []);
  
  // Clear the action history
  const clearActionHistory = useCallback(() => {
    setActionHistory([]);
    try {
      localStorage.removeItem('actionHistory');
      console.log('Cleared action history from localStorage');
    } catch (error) {
      console.error('Error clearing action history from localStorage:', error);
    }
  }, []);
  
  return {
    actionHistory,
    addActionToHistory,
    clearActionHistory
  };
}; 