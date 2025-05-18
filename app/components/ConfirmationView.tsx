// app/components/ConfirmationView.tsx
"use client";

import React from 'react';
import { FileText, Link as LinkIcon, AlertTriangle, Server, CloudCog } from 'lucide-react';
import StyledButton from './StyledButton';

// Define this threshold here for now, will be refined based on ffmpeg.wasm testing
const MAX_CLIENT_SIZE_BYTES = 200 * 1024 * 1024; // 200MB for example

interface ConfirmationViewProps {
  file: File | null;
  link: string | null;
  onConfirm: (processingPath: 'client' | 'server') => void;
  onCancel: () => void;
}

const ConfirmationView: React.FC<ConfirmationViewProps> = ({
  file,
  link,
  onConfirm,
  onCancel,
}) => {
  const isLargeFile = file && file.size > MAX_CLIENT_SIZE_BYTES;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl max-w-lg mx-auto text-slate-700">
      <h2 className="text-2xl font-semibold mb-6 text-center">
        Ready to Transcribe?
      </h2>

      {file && (
        <div className="mb-6 p-4 border border-slate-200 rounded-lg bg-slate-50">
          <div className="flex items-center space-x-3 mb-2">
            <FileText size={24} className="text-sky-600" />
            <h3 className="text-lg font-medium">Selected File:</h3>
          </div>
          <p className="truncate"><strong>Name:</strong> {file.name}</p>
          <p><strong>Size:</strong> {formatFileSize(file.size)}</p>
          <p><strong>Type:</strong> {file.type || 'N/A'}</p>
        </div>
      )}

      {link && (
        <div className="mb-6 p-4 border border-slate-200 rounded-lg bg-slate-50">
          <div className="flex items-center space-x-3 mb-2">
            <LinkIcon size={24} className="text-sky-600" />
            <h3 className="text-lg font-medium">Video Link:</h3>
          </div>
          <p className="break-all"><strong>URL:</strong> {link}</p>
        </div>
      )}

      {isLargeFile && file && ( // Only show for large files
        <div className="mb-6 p-4 border border-amber-300 rounded-lg bg-amber-50 text-amber-700">
          <div className="flex items-start space-x-3">
            <AlertTriangle size={32} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold">Heads up! This is a large video file.</h4>
              <p className="text-sm mt-1">
                ({formatFileSize(file.size)}) - Processing large files entirely in your browser 
                can be slow and resource-intensive.
              </p>
              <p className="text-sm mt-2 font-medium">Choose how to proceed:</p>
            </div>
          </div>
          <div className="mt-4 space-y-3 sm:space-y-0 sm:flex sm:space-x-3">
            <StyledButton
              onClick={() => onConfirm('server')}
              variant="primary"
              className="w-full sm:w-auto group"
            >
              <Server size={18} className="mr-2 group-hover:animate-pulse" />
              Faster Server Processing
            </StyledButton>
            <StyledButton
              onClick={() => onConfirm('client')}
              variant="secondary"
              className="w-full sm:w-auto group"
            >
               <CloudCog size={18} className="mr-2 group-hover:animate-spin-slow" /> 
              Process in Browser (Slower)
            </StyledButton>
          </div>
           <p className="text-xs mt-3 text-amber-600">
            Server processing uploads the file temporarily for audio extraction, then deletes it. Only audio is sent for transcription.
          </p>
        </div>
      )}

      {!isLargeFile && ( // Show for non-large files or links
        <StyledButton
          onClick={() => onConfirm('client')} // Default to client for smaller files/links
          variant="primary"
          size="lg"
          className="w-full"
        >
          Generate Transcript
        </StyledButton>
      )}

      <StyledButton
        onClick={onCancel}
        variant="ghost"
        className="w-full mt-4 text-slate-600 hover:bg-slate-100"
      >
        Back to Selection
      </StyledButton>
    </div>
  );
};

export default ConfirmationView;