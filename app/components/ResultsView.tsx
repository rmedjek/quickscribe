// app/components/ResultsView.tsx
"use client";
import React from 'react';
import StyledButton from './StyledButton';
import DownloadButton from './DownloadButton';
import { DetailedTranscriptionResult } from '../actions/transcribeAudioAction';
import { ClipboardCopy } from 'lucide-react';

interface ResultsViewProps {
  transcriptionData: DetailedTranscriptionResult;
  onRestart: () => void;
}

const ResultsView: React.FC<ResultsViewProps> = ({ transcriptionData, onRestart }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(transcriptionData.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      // You could show an error message to the user here
    });
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl max-w-3xl mx-auto text-slate-700">
      <h2 className="text-3xl font-semibold mb-3 text-center text-green-600">
        Transcription Successful!
      </h2>
      <div className="text-sm text-slate-500 mb-6 text-center">
        <p>Detected Language: <strong>{transcriptionData.language || 'N/A'}</strong></p>
        <p>Audio Duration: <strong>{transcriptionData.duration ? `${transcriptionData.duration.toFixed(2)}s` : 'N/A'}</strong></p>
      </div>

      {/* Transcript Preview */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-medium">Transcript Text</h3>
          <StyledButton onClick={handleCopyToClipboard} variant="ghost" size="sm">
            <ClipboardCopy size={16} className="mr-1.5" />
            {copied ? 'Copied!' : 'Copy Text'}
          </StyledButton>
        </div>
        <div className="max-h-80 overflow-y-auto p-4 border border-slate-200 rounded-lg bg-slate-50">
          <pre className="whitespace-pre-wrap text-sm text-slate-800 leading-relaxed">
            {transcriptionData.text}
          </pre>
        </div>
      </div>

      {/* Download Buttons */}
      <div className="mb-8">
        <h3 className="text-xl font-medium mb-3">Download Files</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DownloadButton
            label="Download .txt"
            fileContent={transcriptionData.text}
            fileName="transcript.txt"
            mimeType="text/plain"
            variant="secondary"
          />
          {transcriptionData.srtContent && (
            <DownloadButton
              label="Download .srt"
              fileContent={transcriptionData.srtContent}
              fileName="transcript.srt"
              mimeType="application/x-subrip"
              variant="secondary"
            />
          )}
          {transcriptionData.vttContent && (
            <DownloadButton
              label="Download .vtt"
              fileContent={transcriptionData.vttContent}
              fileName="transcript.vtt"
              mimeType="text/vtt"
              variant="secondary"
            />
          )}
          {/* TODO: "Download All (.zip)" button if implemented */}
        </div>
      </div>

      <StyledButton onClick={onRestart} variant="primary" size="lg" className="w-full">
        Transcribe Another Video
      </StyledButton>
    </div>
  );
};

export default ResultsView;