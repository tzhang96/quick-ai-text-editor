"use client";

import { kv } from '@vercel/kv';

// Types from historyService for consistency
import type { EditEvent } from './historyService';

/**
 * Client-side interface to the KV storage
 * In the browser, this will call the API routes which interact with KV
 */

// Get edit history from the KV store via API
export const getKVHistory = async (): Promise<EditEvent[]> => {
  try {
    const response = await fetch('/api/kv-history');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch history: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching edit history from KV:', error);
    return [];
  }
};

// Add edit event to the KV store via API
export const addKVEvent = async (event: EditEvent): Promise<void> => {
  try {
    const response = await fetch('/api/kv-history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to save edit event: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error saving edit event to KV:', error);
    throw error;
  }
}; 