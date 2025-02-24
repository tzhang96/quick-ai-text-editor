"use client";

import { GoogleGenerativeAI } from '@google/generative-ai';

// Types for our AI operations
export type AIAction = 'expand' | 'summarize' | 'rephrase' | 'revise';

interface AITransformationRequest {
  text: string;
  action: AIAction;
  additionalInstructions?: string;
  fullDocument?: string; // Optional full document content for context
}

// Initialize the Gemini API with the API key from environment variables
const initializeGemini = () => {
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
      prompt += `Action: Revise and improve this text for clarity and readability. Consider the surrounding document context for consistent style.\n\n`;
      break;
    default:
      prompt += `Action: Process this text appropriately.\n\n`;
  }
  
  if (additionalInstructions) {
    prompt += `Additional instructions: ${additionalInstructions}\n\n`;
  }
  
  prompt += 'Remember to return ONLY the transformed text with no explanations or additional text. Do not include phrases like "Here is the revised text:" or any other introductory or explanatory text.';
  
  return prompt;
};

// Perform AI transformation on the selected text
export const transformText = async (request: AITransformationRequest): Promise<string> => {
  try {
    const genAI = initializeGemini();
    const model = genAI.getGenerativeModel({ 
      model: process.env.NEXT_PUBLIC_GOOGLE_GEMINI_MODEL || 'gemini-2.0-flash'
    });
    
    const prompt = createPrompt(request);
    
    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text();
    
    // Additional cleanup to remove any potential quotes or explanatory text
    text = text.replace(/^["']|["']$/g, ''); // Remove surrounding quotes if present
    text = text.replace(/^Here is the .+?:\s*/i, ''); // Remove intro phrases
    text = text.replace(/```[\s\S]*?```/g, match => match.replace(/```/g, '').trim()); // Remove triple backticks if present
    text = text.trim(); // Remove any leading or trailing whitespace including newlines
    
    return text;
  } catch (error) {
    console.error('Error in Gemini API call:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error in Gemini API call');
  }
};

// Log edit history to both localStorage and the history API
export const logEditHistory = async (
  originalText: string, 
  newText: string, 
  action: AIAction,
  additionalInstructions?: string
) => {
  const editLog = {
    timestamp: new Date().toISOString(),
    action: `AI_${action.toUpperCase()}`,
    originalText,
    newText,
    additionalInstructions
  };
  
  // Log to console for debugging
  console.log('Edit logged:', editLog);
  
  try {
    // Store in localStorage for client-side history viewing
    const history = localStorage.getItem('editHistory');
    const editHistory = history ? JSON.parse(history) : [];
    editHistory.push(editLog);
    localStorage.setItem('editHistory', JSON.stringify(editHistory));
    
    // Save to Vercel KV via API for permanent storage
    try {
      const response = await fetch('/api/kv-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editLog),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save edit history to KV');
      }
    } catch (kvError) {
      console.error('Error saving to KV, falling back to file-based API:', kvError);
      
      // Fallback to original file-based API for backward compatibility
      const fileResponse = await fetch('/api/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalText,
          newText,
          action,
          additionalInstructions
        }),
      });
      
      if (!fileResponse.ok) {
        throw new Error('Failed to save edit history to server');
      }
    }
  } catch (error) {
    // Don't fail the entire operation if history logging fails
    console.error('Error logging edit:', error);
  }
  
  return editLog;
}; 