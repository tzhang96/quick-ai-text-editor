"use client";

import React, { useState, useEffect } from 'react';
import { EditEvent } from '../services/historyService';

interface EditHistoryViewerProps {
  onClose: () => void;
}

const ITEMS_PER_PAGE = 10; // Number of history items to display per page

// Simple hash function to create a more reliable hash for deduplication
const hashString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
};

const EditHistoryViewer: React.FC<EditHistoryViewerProps> = ({ onClose }) => {
  const [history, setHistory] = useState<EditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset to first page when filter changes
    setCurrentPage(1);
  }, [filter]);

  useEffect(() => {
    // Function to load history from localStorage and file API in development
    const loadHistory = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Load from localStorage
        let combinedHistory: EditEvent[] = [];
        const localHistoryString = localStorage.getItem('editHistory');
        
        if (localHistoryString) {
          combinedHistory = JSON.parse(localHistoryString);
        }
        
        // In development environment, also fetch from file API
        const isDevelopment = 
          window.location.hostname === 'localhost' || 
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname.includes('.local');
        
        if (isDevelopment) {
          try {
            const fileResponse = await fetch('/api/history');
            
            if (fileResponse.ok) {
              const fileHistory = await fileResponse.json();
              
              // Combine and deduplicate by comparing timestamps + actions + content hash
              const seen = new Set();
              combinedHistory = [...combinedHistory, ...fileHistory].filter(event => {
                // Create a unique key for this event based on all relevant properties
                // Include timestamp, action, original text (fully hashed), and new text length for uniqueness
                const hash = `${event.timestamp}-${event.action}-${hashString(event.originalText)}-${event.newText.length}`;
                if (seen.has(hash)) return false;
                seen.add(hash);
                return true;
              });
            } else {
              setError('Could not fetch history from file API.');
            }
          } catch (fileError) {
            console.error('Error fetching from file API:', fileError);
            setError('Error connecting to history API.');
          }
        }
        
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

  // Paginate the filtered history
  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
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
    if (action.includes('MANUAL_ADD')) return 'bg-indigo-100 text-indigo-800';
    if (action.includes('MANUAL_DELETE')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };
  
  // Get a user-friendly model name
  const getModelLabel = (modelName: string): string => {
    if (modelName.includes('pro')) return 'Pro';
    if (modelName.includes('flash-lite')) return 'Flash Lite';
    if (modelName.includes('flash')) return 'Flash';
    return modelName; // Fallback to the full name if none match
  };
  
  // Export history to JSON file
  const exportHistory = () => {
    // Export either filtered history or full history based on current filter
    const dataToExport = filter ? filteredHistory : history;
    
    // Create a formatted JSON string with indentation for readability
    const jsonString = JSON.stringify(dataToExport, null, 2);
    
    // Set up the download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edit-history-export-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle page navigation
  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  // Generate pagination buttons
  const renderPaginationButtons = () => {
    if (totalPages <= 1) return null;

    // For smaller paginations, show all pages
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
        <button
          key={page}
          onClick={() => goToPage(page)}
          className={`px-3 py-1 mx-1 rounded ${
            page === currentPage
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          {page}
        </button>
      ));
    }

    // For larger paginations, use ellipsis
    const pages = [];
    
    // Always show first page
    pages.push(
      <button
        key={1}
        onClick={() => goToPage(1)}
        className={`px-3 py-1 mx-1 rounded ${
          currentPage === 1
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        }`}
      >
        1
      </button>
    );

    // Add ellipsis if current page is far from the start
    if (currentPage > 3) {
      pages.push(
        <span key="ellipsis-start" className="px-2">
          ...
        </span>
      );
    }

    // Show pages around current page
    const rangeStart = Math.max(2, currentPage - 1);
    const rangeEnd = Math.min(totalPages - 1, currentPage + 1);
    
    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => goToPage(i)}
          className={`px-3 py-1 mx-1 rounded ${
            i === currentPage
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          {i}
        </button>
      );
    }

    // Add ellipsis if current page is far from the end
    if (currentPage < totalPages - 2) {
      pages.push(
        <span key="ellipsis-end" className="px-2">
          ...
        </span>
      );
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(
        <button
          key={totalPages}
          onClick={() => goToPage(totalPages)}
          className={`px-3 py-1 mx-1 rounded ${
            currentPage === totalPages
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          {totalPages}
        </button>
      );
    }

    return pages;
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
        
        <div className="p-4 border-b flex justify-between items-center">
          <input
            type="text"
            placeholder="Filter history..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full p-2 border rounded"
          />
          
          <button
            onClick={exportHistory}
            className="ml-2 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1"
            title="Export history as JSON"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export JSON
          </button>
        </div>
        
        <div className="bg-blue-50 p-3 text-sm">
          <p className="text-blue-700 mb-1 font-medium">About Edit History Storage:</p>
          <p className="text-blue-600">
            • Your edit history is stored in your browser&apos;s localStorage
            <br />
            {window.location.hostname === 'localhost' || 
             window.location.hostname === '127.0.0.1' || 
             window.location.hostname.includes('.local') ? (
               <>
                 • In development mode, history is also saved to a local file (<code className="bg-blue-100 px-1 rounded">edit-history.json</code>)
                 <br />
               </>
             ) : null}
            • You can export your history to a JSON file for backup
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
              {paginatedHistory.map((event, index) => (
                <div key={index} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${getActionColor(event.action)}`}
                      >
                        {event.action.replace('AI_', '').replace('MANUAL_', 'MANUAL ')}
                      </span>
                      {event.modelName && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">
                          {getModelLabel(event.modelName)}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 ml-auto">
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
        
        {/* Pagination Controls */}
        {!loading && filteredHistory.length > 0 && (
          <div className="p-4 border-t flex justify-center items-center">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 mr-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &larr; Prev
            </button>
            
            <div className="flex">{renderPaginationButtons()}</div>
            
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 ml-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next &rarr;
            </button>
          </div>
        )}
        
        <div className="p-4 border-t flex justify-between items-center">
          {filteredHistory.length > 0 && (
            <div className="text-sm text-gray-500">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredHistory.length)} of {filteredHistory.length} entries
            </div>
          )}
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