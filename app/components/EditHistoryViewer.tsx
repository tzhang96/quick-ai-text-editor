"use client";

import React, { useState, useEffect } from 'react';
import { EditEvent } from '../services/historyService';

interface EditHistoryViewerProps {
  onClose: () => void;
}

const EditHistoryViewer: React.FC<EditHistoryViewerProps> = ({ onClose }) => {
  const [history, setHistory] = useState<EditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Function to load history from both sources
    const loadHistory = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // First load from localStorage (for immediate display and offline access)
        let combinedHistory: EditEvent[] = [];
        const localHistoryString = localStorage.getItem('editHistory');
        
        if (localHistoryString) {
          const localHistory = JSON.parse(localHistoryString);
          combinedHistory = [...localHistory];
        }
        
        // Try to fetch from KV API first
        let serverHistory: EditEvent[] = [];
        let serverError = false;
        
        try {
          const kvResponse = await fetch('/api/kv-history');
          
          if (kvResponse.ok) {
            serverHistory = await kvResponse.json();
          } else {
            serverError = true;
          }
        } catch (kvError) {
          console.error('Error fetching from KV API:', kvError);
          serverError = true;
        }
        
        // If KV fails, try the file-based API as fallback
        if (serverError) {
          try {
            const fileResponse = await fetch('/api/history');
            
            if (fileResponse.ok) {
              serverHistory = await fileResponse.json();
            } else {
              // Both APIs failed
              setError('Could not fetch complete history from server.');
            }
          } catch (fileError) {
            console.error('Error fetching from file API:', fileError);
            setError('Could not fetch complete history from server.');
          }
        }
        
        // Combine and deduplicate histories
        // Using a simple approach comparing timestamps + actions
        const seen = new Set();
        combinedHistory = [...combinedHistory, ...serverHistory].filter(event => {
          const key = `${event.timestamp}-${event.action}-${event.originalText.substring(0, 20)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        
        // Sort by timestamp, newest first
        combinedHistory.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        setHistory(combinedHistory);
      } catch (error) {
        console.error('Error loading history:', error);
        setError('Failed to load edit history.');
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, []);

  // Filter history based on search term
  const filteredHistory = history.filter(event => 
    event.originalText.toLowerCase().includes(filter.toLowerCase()) ||
    event.newText.toLowerCase().includes(filter.toLowerCase()) ||
    event.action.toLowerCase().includes(filter.toLowerCase())
  );

  // Format date for display
  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  // Truncate text for display
  const truncateText = (text: string, maxLength = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Get color for action type
  const getActionColor = (action: string) => {
    if (action.includes('EXPAND')) return 'bg-blue-100 text-blue-800';
    if (action.includes('SUMMARIZE')) return 'bg-green-100 text-green-800';
    if (action.includes('REPHRASE')) return 'bg-yellow-100 text-yellow-800';
    if (action.includes('REVISE')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">Edit History</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="p-4 border-b">
          <input
            type="text"
            placeholder="Filter history..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        
        <div className="bg-blue-50 p-3 text-sm">
          <p className="text-blue-700 mb-1 font-medium">About Edit History Storage:</p>
          <p className="text-blue-600">
            • Client-side history is stored in your browser's localStorage
            <br />
            • Server-side history is saved in Vercel KV (production) or <code className="bg-blue-100 px-1 rounded">edit-history.json</code> (development)
            <br />
            • Your edit history viewer combines both sources for the most complete history
          </p>
        </div>
        
        <div className="overflow-y-auto flex-grow">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading history...</div>
          ) : error ? (
            <div className="p-4 bg-yellow-50 text-yellow-700 text-sm border-l-4 border-yellow-400 mb-4">
              {error} Some items may be missing.
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {filter ? 'No matching history entries found.' : 'No edit history yet.'}
            </div>
          ) : (
            <div className="divide-y">
              {filteredHistory.map((event, index) => (
                <div key={index} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs px-2 py-1 rounded ${getActionColor(event.action)}`}>
                      {event.action.replace('AI_', '')}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatDate(event.timestamp)}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Original:</div>
                      <div className="bg-red-50 p-2 rounded text-sm">
                        {truncateText(event.originalText)}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Modified:</div>
                      <div className="bg-green-50 p-2 rounded text-sm">
                        {truncateText(event.newText)}
                      </div>
                    </div>
                    
                    {event.additionalInstructions && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Instructions:</div>
                        <div className="bg-gray-50 p-2 rounded text-sm italic">
                          {event.additionalInstructions}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditHistoryViewer; 