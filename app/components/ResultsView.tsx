// app/components/ResultsView.tsx
"use client";
import React from 'react';
import StyledButton from './StyledButton';
import DownloadButton from './DownloadButton';
import { DetailedTranscriptionResult } from '../actions/transcribeAudioAction'; // Adjust path if needed
import { ClipboardCopy, Archive } from 'lucide-react'; 
import JSZip from 'jszip'; 

interface ResultsViewProps {
  transcriptionData: DetailedTranscriptionResult;
  onRestart: () => void;
}

const ResultsView: React.FC<ResultsViewProps> = ({ transcriptionData, onRestart }) => {
  const [copied, setCopied] = React.useState(false);
  const [isZipping, setIsZipping] = React.useState(false);

  const handleCopyToClipboard = () => { /* ... same as before ... */ 
    navigator.clipboard.writeText(transcriptionData.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      alert('Failed to copy text to clipboard.');
    });
  };

  const handleDownloadAll = async () => { /* ... same as before ... */ 
    if (!transcriptionData) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      zip.file("transcript.txt", transcriptionData.text);

      if (transcriptionData.srtContent) {
        zip.file("transcript.srt", transcriptionData.srtContent);
      }
      if (transcriptionData.vttContent) {
        zip.file("transcript.vtt", transcriptionData.vttContent);
      }

      // Check if any files were added before generating
      if (Object.keys(zip.files).length === 0) {
        alert("No transcript files available to include in the zip.");
        setIsZipping(false);
        return;
      }

      const zipBlob = await zip.generateAsync({ 
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });
      
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "transcripts.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to generate or download zip file:", error);
      alert("Sorry, couldn't create the zip file. Please try downloading files individually.");
    } finally {
      setIsZipping(false);
    }
  };

  const formatBytesToMB = (bytes?: number): string => { /* ... same as before ... */ 
    if (typeof bytes !== 'number' || bytes === 0) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl max-w-3xl mx-auto text-slate-700">
      <h2 className="text-3xl font-semibold mb-3 text-center text-green-600">
        Transcription Successful!
      </h2>
      <div className="text-sm text-slate-500 mb-6 text-center space-y-1">
        <p>Detected Language: <strong>{transcriptionData.language || 'N/A'}</strong></p>
        <p>Audio Duration: <strong>{transcriptionData.duration ? `${transcriptionData.duration.toFixed(2)}s` : 'N/A'}</strong></p>
        {transcriptionData.extractedAudioSizeBytes !== undefined && (
            <p>Processed Audio Size: <strong>{formatBytesToMB(transcriptionData.extractedAudioSizeBytes)}</strong></p>
        )}
      </div>

      {/* Transcript Preview */}
      <div className="mb-6">
        {/* ... same as before ... */}
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-medium">Transcript Text</h3>
          <StyledButton onClick={handleCopyToClipboard} variant="ghost" size="sm" disabled={copied}>
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

      {/* Download Buttons Section */}
      <div className="mb-8">
        <h3 className="text-xl font-medium mb-4 text-center sm:text-left">Download Files</h3>
        
        {/* Grid for individual download buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
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
        </div>

        {/* Download All Button - Centered below the grid */}
        <div className="flex justify-center">
            <StyledButton 
                onClick={handleDownloadAll} 
                variant="primary" 
                size="md" 
                className="w-full max-w-xs sm:w-auto" // Full width on small, auto on larger, with a max width
                isLoading={isZipping}
                disabled={isZipping}
            >
              <Archive size={18} className="mr-2" /> 
              {isZipping ? 'Zipping...' : 'Download All (.zip)'}
            </StyledButton>
        </div>
      </div>

      <StyledButton onClick={onRestart} variant="primary" size="lg" className="w-full mt-4">
        Transcribe Another Video
      </StyledButton>
    </div>
  );
};

export default ResultsView;