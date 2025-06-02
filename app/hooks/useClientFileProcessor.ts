"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { extractAudio } from '@/lib/ffmpeg-utils'; // Adjust path
import { transcribeAudioAction, DetailedTranscriptionResult } from '@/actions/transcribeAudioAction'; // Adjust path
import { TranscriptionMode } from '@/components/ConfirmationView'; // Adjust path
import { StageDisplayData } from '@/components/ProcessingView'; // Adjust path

const SIMULATED_CLIENT_TRANSCRIPTION_DURATION_MS_HOOK = 20000; // From page.tsx
const PROGRESS_INTERVAL_MS_HOOK = 250;                         // From page.tsx
const GROQ_AUDIO_LIMIT_BYTES_HOOK = 24 * 1024 * 1024;          // From page.tsx

interface ClientFileProcessorOptions {
  ffmpeg: FFmpeg | null;
  onProcessingComplete: (data: DetailedTranscriptionResult) => void;
  onError: (errorMessage: string, fileName?: string, fileSizeMB?: string) => void;
  onStatusUpdate: (message: string) => void;
  onStagesUpdate: (stages: StageDisplayData[]) => void;
}

export function useClientFileProcessor({
  ffmpeg,
  onProcessingComplete,
  onError,
  onStatusUpdate,
  onStagesUpdate,
}: ClientFileProcessorOptions) {
  const [isProcessing, setIsProcessing] = useState(false);
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearSimulation = useCallback(() => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
  }, []);

  useEffect(() => { // Cleanup on unmount
    return () => clearSimulation();
  }, [clearSimulation]);

  const updateStage = useCallback(
    (stages: StageDisplayData[], stageName: string, values: Partial<Omit<StageDisplayData, 'name'>>) => {
      const newStages = stages.map(s => s.name === stageName ? { ...s, ...values } : s);
      onStagesUpdate(newStages);
      return newStages; // Return updated stages for immediate use if needed
    },
    [onStagesUpdate]
  );

  const processFile = useCallback(async (fileToProcess: File, mode: TranscriptionMode) => {
    if (!ffmpeg) {
      onError("FFmpeg is not loaded.", fileToProcess.name, (fileToProcess.size / (1024*1024)).toFixed(2));
      return;
    }

    setIsProcessing(true);
    onStatusUpdate("Processing your video...");
    let currentStages: StageDisplayData[] = [
      { name: 'ClientAudioExtraction', label: 'Extracting audio', progress: 0, isActive: true, isComplete: false, isIndeterminate: false, subText: "Preparing..." },
      { name: 'ClientTranscription', label: 'Generating transcript', progress: 0, isActive: false, isComplete: false, isIndeterminate: true, subText: "Waiting for audio..." },
    ];
    onStagesUpdate(currentStages);

    try {
      currentStages = updateStage(currentStages, 'ClientAudioExtraction', { isActive: true, isIndeterminate: false, progress: 0.01, label: 'Extracting audio from video', subText: 'Using in-browser technology...' });
      
      const audioBlob = await extractAudio({
        file: fileToProcess, outputFormat: 'opus',
        onLog: (logMsg) => console.log('[FFMPEG_CLIENT_HOOK_LOG]', logMsg),
        onProgress: (progVal) => {
          // This update won't reflect immediately in `currentStages` variable due to closure,
          // so we use the functional update form of onStagesUpdate or pass the new array back.
          // For simplicity, onStagesUpdate will use setProcessingUIStages's functional update.
          onStagesUpdate(
            currentStages.map(s =>
              s.name === 'ClientAudioExtraction'
                ? { ...s, progress: progVal, label: `Extracting audio... ${Math.round(progVal * 100)}%` }
                : s
            )
          );
        },
      });
      currentStages = updateStage(currentStages, 'ClientAudioExtraction', { progress: 1, isActive: false, isComplete: true, label: 'Audio Extracted!', subText: '✓ Done' });
      
      const audioSizeMB = audioBlob.size / (1024 * 1024);
      if (audioBlob.size > GROQ_AUDIO_LIMIT_BYTES_HOOK) {
        throw new Error(`Extracted audio (${audioSizeMB.toFixed(2)} MB) exceeds transcription service limit of ${(GROQ_AUDIO_LIMIT_BYTES_HOOK / (1024*1024)).toFixed(0)} MB.`);
      }

      onStatusUpdate("AI is transcribing your audio...");
      currentStages = updateStage(currentStages, 'ClientTranscription', { isActive: true, isIndeterminate: true, label: "AI Transcribing", progress: 0.01, subText: "Sending to Groq..." });
      
      let currentStep = 0;
      const totalSteps = SIMULATED_CLIENT_TRANSCRIPTION_DURATION_MS_HOOK / PROGRESS_INTERVAL_MS_HOOK;
      clearSimulation();
      simulationIntervalRef.current = setInterval(() => {
        currentStep++;
        const simProgress = Math.min(0.98, currentStep / totalSteps);
        const updatedStages = currentStages.map(s => s.name === 'ClientTranscription' ? { ...s, progress: simProgress } : s);
        onStagesUpdate(updatedStages);
        if (currentStep >= totalSteps) clearSimulation();
      }, PROGRESS_INTERVAL_MS_HOOK);

      const formData = new FormData();
      formData.append("audioBlob", audioBlob, `audio.${audioBlob.type.split('/')[1] || 'opus'}`);
      const response = await transcribeAudioAction(formData, mode);
      
      clearSimulation();
      currentStages = updateStage(currentStages, 'ClientTranscription', { progress: 1, isActive: false, isComplete: true, isIndeterminate: false, label: 'Transcription Complete!', subText: '✓ Done' });

      if (response.success && response.data) {
        onStatusUpdate('Transcription complete!');
        onProcessingComplete(response.data);
      } else { 
        throw new Error(response.error || "Client-side transcription pipeline failed."); 
      }
    } catch (error) { 
        clearSimulation();
        const originalErrorMessage = error instanceof Error ? error.message : String(error);
        onError(originalErrorMessage, fileToProcess?.name, fileToProcess ? (fileToProcess.size / (1024*1024)).toFixed(2) : undefined);
    } finally {
        setIsProcessing(false);
    }
  }, [ffmpeg, onStatusUpdate, onStagesUpdate, onError, updateStage, clearSimulation, onProcessingComplete]);

  return { processFile, isProcessing };
}