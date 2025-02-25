import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { EditEvent } from '@/app/services/historyService';
import type { AIAction } from '@/app/services/geminiService';
import type { GeminiModel } from '@/app/services/geminiService';

const LOG_FILE_PATH = path.join(process.cwd(), 'edit-history.json');

// Initialize the log file if it doesn't exist
const initLogFile = async (): Promise<void> => {
  try {
    // Check if the file exists
    if (!fs.existsSync(LOG_FILE_PATH)) {
      // Create the file with an empty array
      await fs.promises.writeFile(LOG_FILE_PATH, JSON.stringify([]));
    }
  } catch (error) {
    console.error('Error initializing log file:', error);
  }
};

// Get all edit history events from the server file
const getServerHistoryEvents = async (): Promise<EditEvent[]> => {
  try {
    await initLogFile();
    
    const data = await fs.promises.readFile(LOG_FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading edit history from server:', error);
    return [];
  }
};

// Add a new edit event to the history file
const addServerHistoryEvent = async (event: EditEvent): Promise<void> => {
  try {
    await initLogFile();
    
    // Read current history
    const history = await getServerHistoryEvents();
    
    // Add new event
    history.push(event);
    
    // Write updated history back to file
    await fs.promises.writeFile(LOG_FILE_PATH, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('Error logging edit event to server:', error);
    throw error;
  }
};

// Server-side version of createEditEvent
const serverCreateEditEvent = (
  originalText: string,
  newText: string,
  action: string | AIAction,
  additionalInstructions?: string,
  modelName?: GeminiModel,
  timestamp?: string
): EditEvent => {
  return {
    timestamp: timestamp || new Date().toISOString(),
    action: formatActionName(action),
    originalText,
    newText,
    additionalInstructions,
    modelName
  };
};

// Format the action name - server-side implementation
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

// GET /api/history - Get all edit history events
export async function GET() {
  try {
    const history = await getServerHistoryEvents();
    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching edit history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch edit history' },
      { status: 500 }
    );
  }
}

// POST /api/history - Add a new edit event
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { timestamp, originalText, newText, action, additionalInstructions, modelName } = data;
    
    // Validate required fields
    if (!originalText || !newText || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Create and save the event using server-side implementation
    const event = serverCreateEditEvent(originalText, newText, action, additionalInstructions, modelName, timestamp);
    await addServerHistoryEvent(event);
    
    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error('Error adding edit event:', error);
    return NextResponse.json(
      { error: 'Failed to add edit event' },
      { status: 500 }
    );
  }
} 