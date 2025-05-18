// app/components/ProcessingView.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react'; // Or another suitable loader icon

interface ProcessingViewProps {
  statusMessages: string[]; // Array of messages to display sequentially or as a list
  progress?: number; // Overall progress 0-1
  currentStageProgress?: number; // Progress for the current stage 0-1
}

const ProcessingView: React.FC<ProcessingViewProps> = ({
  statusMessages,
  progress,
  currentStageProgress,
}) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const lastMessage = statusMessages.length > 0 ? statusMessages[statusMessages.length -1] : "Processing...";

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl max-w-lg mx-auto text-center text-slate-700">
      <Loader2 size={48} className="text-sky-600 animate-spin mx-auto mb-6" />
      <h2 className="text-xl font-semibold mb-4">
        {lastMessage}{dots}
      </h2>
      
      {/* Display all status messages if needed, or just the latest one */}
      {/* <ul className="text-sm text-slate-500 space-y-1 mb-4 list-disc list-inside">
        {statusMessages.map((msg, index) => (
          <li key={index}>{msg}</li>
        ))}
      </ul> */}

      {typeof currentStageProgress === 'number' && (
        <div className="w-full bg-slate-200 rounded-full h-2.5 mb-2 overflow-hidden">
          <div
            className="bg-sky-600 h-2.5 rounded-full transition-all duration-300 ease-linear"
            style={{ width: `${Math.min(100, Math.max(0, currentStageProgress * 100))}%` }}
          ></div>
        </div>
      )}
      {typeof currentStageProgress === 'number' && (
         <p className="text-xs text-slate-500 mb-4">
            Current step: {Math.round(currentStageProgress * 100)}%
        </p>
      )}


      {typeof progress === 'number' && (
        <>
        <div className="w-full bg-slate-200 rounded-full h-4 mb-2 overflow-hidden border border-slate-300">
          <div
            className="bg-emerald-500 h-4 rounded-full transition-all duration-300 ease-linear flex items-center justify-center text-xs font-medium text-white"
            style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
          >
             {/* {Math.round(progress * 100)}% Overall */}
          </div>
        </div>
         <p className="text-sm text-slate-600">
            Overall Progress: {Math.round(progress * 100)}%
        </p>
        </>
      )}

      <p className="text-xs text-slate-500 mt-6">
        This might take a few moments, especially for larger files. Please keep this tab open.
      </p>
    </div>
  );
};

export default ProcessingView;