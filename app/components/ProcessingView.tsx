// app/components/ProcessingView.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface ProcessingViewProps {
  currentStageMessage: string; 
  overallProgress: number; // Progress from 0 to 1
  isIndeterminate?: boolean; // Flag to indicate if current stage is indeterminate (like AI processing)
}

const ProcessingView: React.FC<ProcessingViewProps> = ({
  currentStageMessage,
  overallProgress,
  isIndeterminate = false,
}) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const progressPercent = Math.min(100, Math.max(0, overallProgress * 100));

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl max-w-lg mx-auto text-center text-slate-700">
      <Loader2 size={48} className="text-sky-600 animate-spin mx-auto mb-6" />
      <h2 className="text-xl font-semibold mb-4">
        {currentStageMessage}{dots}
      </h2>
      
      <div className={`h-4 rounded-full 
            ${isIndeterminate ? 'bg-sky-600 barberpole-stripes w-full' : 'bg-emerald-500 transition-all duration-300 ease-linear'}`}
            style={{ width: `${isIndeterminate ? '100%' : progressPercent + '%'}` }}
      >
        {!isIndeterminate && (
          <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-sky-800">
            {Math.round(progressPercent)}%
          </div>)}
      </div>
       <p className="text-sm text-slate-600">
            Overall Progress
       </p>

      <p className="text-xs text-slate-500 mt-6">
        This might take a few moments, especially for larger files. Please keep this tab open.
      </p>
    </div>
  );
};

export default ProcessingView;