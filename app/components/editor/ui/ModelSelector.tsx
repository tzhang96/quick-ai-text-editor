import React from 'react';
import { GeminiModel } from '../../../services/geminiService';

interface ModelSelectorProps {
  isOpen: boolean;
  selectedModel: GeminiModel;
  onModelSelect: (model: GeminiModel) => void;
  onClose: () => void;
}

// Model descriptions for the UI
const MODEL_DESCRIPTIONS: Record<GeminiModel, string> = {
  'gemini-2.0-flash-lite': 'Fast, efficient model for quick responses',
  'gemini-2.0-flash': 'Balanced model with good performance',
  'gemini-2.0-pro-exp-02-05': 'Advanced model with highest quality responses',
};

const ModelSelector: React.FC<ModelSelectorProps> = ({
  isOpen,
  selectedModel,
  onModelSelect,
  onClose
}) => {
  if (!isOpen) return null;
  
  // Available models
  const models: GeminiModel[] = [
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-pro-exp-02-05',
  ];
  
  // Handle model selection and close the selector
  const handleSelectModel = (model: GeminiModel) => {
    onModelSelect(model);
    onClose(); // Close the selector after selection
  };
  
  return (
    <div className="absolute right-0 top-12 z-10 w-64 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
      <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="model-selector-button">
        {models.map((model) => (
          <button
            key={model}
            className={`block w-full px-4 py-2 text-left text-sm ${
              model === selectedModel ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'
            }`}
            role="menuitem"
            onClick={() => handleSelectModel(model)}
          >
            <div className="font-medium">{model}</div>
            <div className="text-xs text-gray-500">{MODEL_DESCRIPTIONS[model]}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ModelSelector; 