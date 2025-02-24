import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import type { EditEvent } from '@/app/services/historyService';

const HISTORY_KEY = 'edit-history';

// Helper function to ensure our code works in local and production environments
const getKV = () => {
  // Check if KV is actually available
  if (!kv) {
    console.warn('Vercel KV is not available - using a mock implementation');
    
    // If running locally without KV, provide a mock implementation
    // This won't persist between server restarts, but allows for development
    const mockStorage: Record<string, any> = {};
    
    return {
      get: async (key: string) => mockStorage[key] || null,
      set: async (key: string, value: any) => {
        mockStorage[key] = value;
        return 'OK';
      },
      hget: async (key: string, field: string) => {
        const hash = mockStorage[key] || {};
        return hash[field] || null;
      },
      hset: async (key: string, field: string, value: any) => {
        mockStorage[key] = mockStorage[key] || {};
        mockStorage[key][field] = value;
        return 1;
      }
    };
  }
  
  // Return the actual KV instance
  return kv;
};

// GET /api/kv-history - Fetch all edit history events
export async function GET() {
  try {
    const kvInstance = getKV();
    const history = await kvInstance.get<EditEvent[]>(HISTORY_KEY) || [];
    
    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching edit history from KV:', error);
    return NextResponse.json(
      { error: 'Failed to fetch edit history' },
      { status: 500 }
    );
  }
}

// POST /api/kv-history - Add a new edit event
export async function POST(request: Request) {
  try {
    const event: EditEvent = await request.json();
    const kvInstance = getKV();
    
    // Validate event
    if (!event.originalText || !event.newText || !event.action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Get current history
    const history = await kvInstance.get<EditEvent[]>(HISTORY_KEY) || [];
    
    // Add new event
    history.push(event);
    
    // Save updated history
    await kvInstance.set(HISTORY_KEY, history);
    
    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error('Error adding edit event to KV:', error);
    return NextResponse.json(
      { error: 'Failed to add edit event' },
      { status: 500 }
    );
  }
} 