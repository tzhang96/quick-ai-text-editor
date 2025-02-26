"use client";

import { GoogleGenerativeAI } from '@google/generative-ai';

// Types for our AI operations
export type AIAction = 'expand' | 'summarize' | 'rephrase' | 'revise';

// Define valid Gemini model types
export type GeminiModel = 
  | 'gemini-2.0-pro-exp-02-05'  // The Pro version
  | 'gemini-2.0-flash'         // The Flash version
  | 'gemini-2.0-flash-lite';  // The Flash Lite version

// Default model to use
export const DEFAULT_MODEL: GeminiModel = 'gemini-2.0-flash';

interface AITransformationRequest {
  text: string;
  action: AIAction;
  additionalInstructions?: string;
  fullDocument?: string; // Optional full document content for context
}

// Initialize the Gemini API with the API key from environment variables
export const initializeGemini = () => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY is not defined in your environment variables');
  }
  
  return new GoogleGenerativeAI(apiKey);
};

// Create the prompt for the Gemini API based on the action and additional instructions
const createPrompt = (request: AITransformationRequest): string => {
  const { text, action, additionalInstructions, fullDocument } = request;
  
  let prompt = 'IMPORTANT: Return ONLY the transformed text without any explanations, introductions, or commentary.\n\n';
  
  // If we have the full document, include it for context
  if (fullDocument) {
    prompt += `Below is the full document for context. You'll be asked to transform only a specific part of it:\n\n${fullDocument}\n\n`;
    prompt += `Now, please focus ONLY on transforming the following specific text (marked between triple backticks):\n\n\`\`\`\n${text}\n\`\`\`\n\n`;
  } else {
    // No full document provided, just use the selected text
    prompt += `Transform the following text:\n\n"${text}"\n\n`;
  }
  
  // Add action-specific instructions
  switch (action) {
    case 'expand':
      prompt += `Action: Expand this text with more details and context while maintaining consistency with the surrounding document.\n\n`;
      break;
    case 'summarize':
      prompt += `Action: Summarize this text concisely while preserving the key points.\n\n`;
      break;
    case 'rephrase':
      prompt += `Action: Rephrase this text while preserving its meaning. Use the surrounding document context to ensure consistent tone and terminology.\n\n`;
      break;
    case 'revise':
      prompt += `Action: Correct any factual errors, inconsistencies, or inaccuracies in this text. Maintain the original style and tone while fixing only the problematic content.\n\n`;
      break;
    default:
      prompt += `Action: Process this text appropriately.\n\n`;
  }
  
  if (additionalInstructions) {
    prompt += `Additional instructions/information: ${additionalInstructions}\n\n`;
  }
  
  prompt += 'Remember to return ONLY the transformed text with no explanations or additional text. Do not include phrases like "Here is the revised text:" or any other introductory or explanatory text.';
  
  return prompt;
};

// Perform AI transformation on the selected text
export const transformText = async (
  request: AITransformationRequest, 
  modelName: GeminiModel = DEFAULT_MODEL
): Promise<string> => {
  try {
    const genAI = initializeGemini();
    // Use the provided model or fall back to the default
    const model = genAI.getGenerativeModel({ 
      model: modelName
    });
    
    console.log(`Using Gemini model: ${modelName}`);
    
    const prompt = createPrompt(request);
    
    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text();
    
    // Remove intro phrases but preserve internal quotes
    text = text.replace(/^Here is the .+?:\s*/i, '');
    
    // Remove triple backticks if present
    text = text.replace(/```[\s\S]*?```/g, match => match.replace(/```/g, '').trim());
    
    // Remove any leading or trailing whitespace including newlines
    text = text.trim();
    
    return text;
  } catch (error) {
    console.error('Error in Gemini API call:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error in Gemini API call');
  }
};

// Log edit history to localStorage and file API (in development)
export const logEditHistory = async (
  originalText: string, 
  newText: string, 
  action: AIAction | string,
  additionalInstructions?: string,
  modelName?: GeminiModel
) => {
  // Format action properly
  let formattedAction: string;
  
  if (typeof action === 'string') {
    // Handle string actions (like manual edits)
    if (action.startsWith('manual_')) {
      formattedAction = `MANUAL_${action.substring(7).toUpperCase()}`;
    } else if (action === '') {
      // Skip empty actions (used for signaling popup close)
      return;
    } else {
      formattedAction = `AI_${action.toUpperCase()}`;
    }
  } else {
    // Handle specific AIAction enum values
    switch(action) {
      case 'expand':
        formattedAction = 'AI_EXPAND';
        break;
      case 'summarize':
        formattedAction = 'AI_SUMMARIZE';
        break;
      case 'rephrase':
        formattedAction = 'AI_REPHRASE';
        break;
      case 'revise':
        formattedAction = 'AI_REVISE';
        break;
      default:
        formattedAction = 'AI_ACTION';
    }
  }
    
  const timestamp = new Date().toISOString();
  
  const editLog = {
    timestamp,
    action: formattedAction,
    originalText,
    newText,
    additionalInstructions,
    modelName: modelName || DEFAULT_MODEL // Ensure we always have a model name
  };
  
  // Log to console for debugging
  console.log('Edit logged:', editLog);
  
  try {
    // Always store in localStorage for client-side history viewing
    const history = localStorage.getItem('editHistory');
    const editHistory = history ? JSON.parse(history) : [];
    editHistory.unshift(editLog); // Add to beginning for newest-first order
    
    // Limit history to most recent 100 entries to prevent localStorage from getting too large
    const limitedHistory = editHistory.slice(0, 100);
    localStorage.setItem('editHistory', JSON.stringify(limitedHistory));
    console.log('Edit history saved to localStorage, entries:', limitedHistory.length);
    
    // Also save to file API in development (not in production)
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('.local')) {
      try {
        const response = await fetch('/api/history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timestamp,
            originalText,
            newText,
            action: formattedAction, // Use formatted action
            additionalInstructions,
            modelName: modelName || DEFAULT_MODEL
          }),
        });
        
        if (!response.ok) {
          console.warn('Could not save edit history to file (development only)');
        }
      } catch (apiError) {
        // Don't fail if the API call fails
        console.warn('Error saving to history API (development only):', apiError);
      }
    }
  } catch (error) {
    console.error('Error saving edit history:', error);
  }
}; 