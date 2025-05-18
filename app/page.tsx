// app/page.tsx
"use client";

import React, { useEffect, useState, useRef, ChangeEvent } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg'; // Import the type for state
import PageLayout from '@/components/PageLayout'; // Assuming you want the layout
import { extractAudio, getFFmpegInstance } from './lib/ffmpeg-utils';
// You might want a StyledButton here too if you're not using the default button
// import StyledButton from '@/components/StyledButton'; 

export default function HomePage() {
  const [ffmpeg, setFfmpeg] = useState<FFmpeg | null>(null);
  const [message, setMessage] = useState('Initializing FFmpeg...');
  const [progress, setProgress] = useState(0); // For FFmpeg progress (0-1)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null); // To display selected file name
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load FFmpeg instance on component mount
  useEffect(() => {
    async function loadFFmpeg() {
      setMessage('Loading FFmpeg, please wait...');
      setProgress(0);
      try {
        const instance = await getFFmpegInstance(
          (logMsg) => console.log('[FFMPEG CORE LOG]:', logMsg),
          (progVal) => {
            console.log('[FFMPEG CORE PROGRESS - Load Phase]:', progVal);
            // Typically, load progress isn't granularly reported by ffmpeg.wasm's load()
            // but if it were, you could use it here.
            // For now, setProgress will be mainly used by the exec phase.
          }
        );
        setFfmpeg(instance);
        const loaded = typeof instance.isLoaded === 'function' ? instance.isLoaded() : true;
        setMessage(loaded ? 'FFmpeg Loaded Successfully! Ready to process.' : 'FFmpeg instance obtained, load status uncertain.');
      } catch (error) {
        console.error("Page: Failed to load FFmpeg:", error);
        setMessage(`Failed to load FFmpeg: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    loadFFmpeg();
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFileName(files[0].name);
      setAudioBlobUrl(null); // Reset previous audio
      setMessage(`File selected: ${files[0].name}. Click process.`);
    } else {
      setSelectedFileName(null);
      setMessage('No file selected. FFmpeg is ready.');
    }
  };

  const handleFileProcess = async () => {
    if (!ffmpeg || !fileInputRef.current?.files?.length) {
      setMessage('Please select a file first, or FFmpeg not ready.');
      return;
    }
    const fileToProcess = fileInputRef.current.files[0];
    
    setIsProcessing(true);
    setProgress(0); 
    setAudioBlobUrl(null); 
    setMessage(`Processing ${fileToProcess.name}...`);

    try {
      const audioBlob = await extractAudio({
        file: fileToProcess,
        outputFormat: 'opus', // You can change this to 'mp3' if you prefer for testing
        onLog: (logMsg) => console.log('[AUDIO EXTRACT LOG]:', logMsg),
        onProgress: (progVal) => {
          console.log('[AUDIO EXTRACT PROGRESS - from page]:', progVal);
          setProgress(progVal); 
          setMessage(`Extracting audio... ${Math.round(progVal * 100)}%`);
        },
      });
      
      setMessage(`Successfully extracted audio! Blob size: ${audioBlob.size}, type: ${audioBlob.type}`);
      const url = URL.createObjectURL(audioBlob);
      setAudioBlobUrl(url);
      console.log('Audio Blob URL:', url);
    } catch (error) {
      setMessage(`Error extracting audio: ${error instanceof Error ? error.message : String(error)}`);
      console.error("Error during audio extraction in page:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <PageLayout>
      <div className="text-center p-6 sm:p-10 bg-white shadow-xl rounded-lg space-y-6 max-w-2xl mx-auto">
        <h2 className="text-3xl font-semibold text-slate-700">
          Test FFmpeg Audio Extraction
        </h2>
        <p className={`text-lg ${message.startsWith('Failed') || message.startsWith('Error') ? 'text-red-600' : 'text-slate-600'}`}>
          {message}
        </p>
        
        {ffmpeg && !isProcessing && (
          <div className="my-4">
            <label htmlFor="file-upload" className="mb-2 block text-sm font-medium text-slate-700">
              Choose a video file:
            </label>
            <input 
              id="file-upload"
              type="file" 
              accept="video/mp4,video/webm,video/quicktime,video/*" 
              ref={fileInputRef}
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-sky-100 file:text-sky-700
                hover:file:bg-sky-200 cursor-pointer border border-slate-300 rounded-lg p-1"
            />
            {selectedFileName && <p className="text-xs text-slate-500 mt-1">Selected: {selectedFileName}</p>}
          </div>
        )}

        <button 
          onClick={handleFileProcess} 
          disabled={!ffmpeg || isProcessing || !fileInputRef.current?.files?.length}
          className="w-full px-6 py-3 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed transition-opacity"
        >
          {isProcessing ? `Processing... ${Math.round(progress * 100)}%` : 'Process Video to Audio'}
        </button>

        {isProcessing && typeof progress === 'number' && (
          <div className="w-full bg-slate-200 rounded-full h-3 mt-4 overflow-hidden">
            <div
              className="bg-sky-500 h-3 rounded-full transition-all duration-150 ease-linear"
              style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
            ></div>
          </div>
        )}

        {audioBlobUrl && !isProcessing && (
          <div className="mt-8 p-4 border border-green-200 bg-green-50 rounded-lg">
            <h3 className="text-xl font-medium text-green-700 mb-3">Extracted Audio Ready!</h3>
            <audio controls src={audioBlobUrl} className="w-full"></audio>
            <p className="mt-3 text-center">
              <a 
                href={audioBlobUrl} 
                download={`extracted_audio.opus`} // Default to opus or make dynamic based on outputFormat
                className="inline-block px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
              >
                Download Extracted Audio (.opus)
              </a>
            </p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}