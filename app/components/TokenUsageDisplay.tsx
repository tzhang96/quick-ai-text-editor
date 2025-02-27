"use client";

import React, { useEffect, useState } from 'react';
import { Editor } from '@tiptap/react';
import { estimateTokenCount, getTokenLimit } from '../services/geminiService';

interface TokenUsageDisplayProps {
  editor: Editor | null;
  className?: string;
}

const TokenUsageDisplay: React.FC<TokenUsageDisplayProps> = ({ 
  editor, 
  className = '' 
}) => {
  const [tokenCount, setTokenCount] = useState(0);
  const [tokenLimit, setTokenLimit] = useState(getTokenLimit());
  const [isNearLimit, setIsNearLimit] = useState(false);
  const [isOverLimit, setIsOverLimit] = useState(false);
  
  // Refresh token limit from environment
  useEffect(() => {
    // Check for token limit changes every 5 seconds
    const intervalId = setInterval(() => {
      const currentLimit = getTokenLimit();
      if (currentLimit !== tokenLimit) {
        setTokenLimit(currentLimit);
      }
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, [tokenLimit]);
  
  // Update token count when editor content changes
  useEffect(() => {
    if (!editor) return;
    
    const updateTokenCount = () => {
      const content = editor.getHTML();
      const count = estimateTokenCount(content);
      setTokenCount(count);
      
      // Check if we're approaching the limit (80% or more)
      setIsNearLimit(count >= tokenLimit * 0.8 && count < tokenLimit);
      setIsOverLimit(count >= tokenLimit);
    };
    
    // Initial count
    updateTokenCount();
    
    // Subscribe to editor updates
    const handleUpdate = () => {
      updateTokenCount();
    };
    
    editor.on('update', handleUpdate);
    
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, tokenLimit]);
  
  // Get the appropriate color based on token usage
  const getStatusColor = () => {
    if (isOverLimit) return 'text-red-600';
    if (isNearLimit) return 'text-amber-600';
    return 'text-gray-600';
  };
  
  // Get progress bar color
  const getProgressBarColor = () => {
    if (isOverLimit) return 'bg-red-500';
    if (isNearLimit) return 'bg-amber-500';
    return 'bg-blue-500';
  };
  
  // Only show the token count when approaching or exceeding the limit
  if (!isNearLimit && !isOverLimit) {
    return null;
  }
  
  const percentage = Math.min(Math.round((tokenCount / tokenLimit) * 100), 100);
  
  return (
    <div className={`flex flex-col ${className}`}>
      <div className={`flex items-center text-xs ${getStatusColor()} mb-1`}>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="currentColor" 
          className="w-3.5 h-3.5 mr-1"
        >
          <path 
            fillRule="evenodd" 
            d="M4.125 3C3.089 3 2.25 3.84 2.25 4.875V18a3 3 0 0 0 3 3h15a.75.75 0 0 0 0-1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V4.875C3.75 4.666 3.917 4.5 4.125 4.5H19.5c.208 0 .375.166.375.375v4.5a.75.75 0 0 0 1.5 0v-4.5C21.375 3.839 20.535 3 19.5 3h-15Z" 
            clipRule="evenodd" 
          />
          <path 
            fillRule="evenodd" 
            d="M6 6.75A.75.75 0 0 1 6.75 6h.75a.75.75 0 0 1 0 1.5h-.75A.75.75 0 0 1 6 6.75Zm4.5 0a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75ZM6 9.75A.75.75 0 0 1 6.75 9h.75a.75.75 0 0 1 0 1.5h-.75A.75.75 0 0 1 6 9.75Zm4.5 0a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75ZM6 12.75a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 0 1.5h-.75a.75.75 0 0 1-.75-.75Zm4.5 0a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75ZM6 15.75a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 0 1.5h-.75a.75.75 0 0 1-.75-.75Zm4.5 0a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75Z" 
            clipRule="evenodd" 
          />
        </svg>
        <span>
          {isOverLimit ? (
            <strong>{tokenCount.toLocaleString()} / {tokenLimit.toLocaleString()} tokens ({percentage}%)</strong>
          ) : (
            <span>{tokenCount.toLocaleString()} / {tokenLimit.toLocaleString()} tokens ({percentage}%)</span>
          )}
        </span>
      </div>
      
      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div 
          className={`${getProgressBarColor()} h-1.5 transition-all duration-300 ease-in-out`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default TokenUsageDisplay; 