import { AIAction, GeminiModel } from '../services/geminiService';

// Type for action history item
export interface ActionHistoryItem {
  action: AIAction;
  instructions: string;
  timestamp: number;
  modelName: GeminiModel;
}

// Interface for tracking text changes for manual edits
export interface TextChangeTracker {
  previousContent: string;
  changeTimer: NodeJS.Timeout | null;
  isTracking: boolean;
  ignoreNextChange: boolean; // Flag to ignore changes immediately following AI action
}

// Maximum number of actions to keep in history
export const MAX_ACTION_HISTORY = 10; 