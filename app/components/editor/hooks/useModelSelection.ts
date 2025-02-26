import { useCallback, useState } from 'react';
import { GeminiModel } from '../../../services/geminiService';

export const useModelSelection = (initialModel: GeminiModel = 'gemini-2.0-flash-lite') => {
  const [selectedModel, setSelectedModel] = useState<GeminiModel>(initialModel);
  const [showModelSelector, setShowModelSelector] = useState(false);
  
  // Toggle the model selector
  const toggleModelSelector = useCallback(() => {
    setShowModelSelector((prev) => !prev);
  }, []);
  
  // Close the model selector
  const closeModelSelector = useCallback(() => {
    setShowModelSelector(false);
  }, []);
  
  // Handle model selection
  const handleModelSelect = useCallback((model: GeminiModel) => {
    setSelectedModel(model);
    closeModelSelector();
  }, [closeModelSelector]);
  
  return {
    selectedModel,
    showModelSelector,
    toggleModelSelector,
    closeModelSelector,
    handleModelSelect
  };
}; 