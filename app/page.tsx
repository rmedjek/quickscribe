// app/page.tsx
"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import PageLayout from '@/components/PageLayout';
import InputSelectionView from '@/components/InputSelectionView';
import ConfirmationView from '@/components/ConfirmationView';
import ProcessingView from '@/components/ProcessingView';
import StyledButton from '@/components/StyledButton'; // For the error view
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { DetailedTranscriptionResult, transcribeAudioAction } from './actions/transcribeAudioAction';
import { extractAudio, getFFmpegInstance } from './lib/ffmpeg-utils';
import ResultsView from './components/ResultsView';
import { processVideoLinkAction } from '@/actions/processVideoLinkAction'; // Import the new action


enum ViewState {
  SelectingInput,
  ConfirmingInput,
  ProcessingClient,
  // ProcessingServer, // For Path B later
  ShowingResults,
  Error,
}

// For progress tracking
interface ProcessingStage {
  name: string;
  weight: number; // How much this stage contributes to overall progress (0-1)
  currentProgress: number; // Progress within this stage (0-1)
  isIndeterminate?: boolean; // Add this
}

export default function HomePage() {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.SelectingInput);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submittedLink, setSubmittedLink] = useState<string | null>(null); // For future link processing
  const [ffmpeg, setFfmpeg] = useState<FFmpeg | null>(null);
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [currentStageMessage, setCurrentStageMessage] = useState<string>('');
  const [processingStages, setProcessingStages] = useState<ProcessingStage[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isIndeterminateProgress, setIsIndeterminateProgress] = useState(false);
  const [transcriptionData, setTranscriptionData] = useState<DetailedTranscriptionResult | null>(null);
  const transcriptionProgressIntervalRef = useRef<NodeJS.Timeout | null>(null); 

  // Load FFmpeg on initial mount
  useEffect(() => {
    async function loadFFmpeg() {
      try {
        console.log("MainPage: Initializing FFmpeg...");
        const instance = await getFFmpegInstance(
          (logMsg) => console.log('[FFMPEG CORE LOG - MainPage]:', logMsg),
          // Core load progress isn't usually granular, so not setting progress here
        );
        setFfmpeg(instance);
        console.log("MainPage: FFmpeg instance ready.");
      } catch (error) {
        console.error("MainPage: Failed to load FFmpeg on init:", error);
        setErrorMessage(`Critical Error: Could not initialize FFmpeg. ${error instanceof Error ? error.message : String(error)}`);
        setCurrentView(ViewState.Error);
      }
    }
    loadFFmpeg();
  }, []);

  // Cleanup interval on component unmount or when processing ends/is reset
  useEffect(() => {
    return () => {
      if (transcriptionProgressIntervalRef.current) {
        clearInterval(transcriptionProgressIntervalRef.current);
      }
    };
  }, []);

// app/page.tsx
const handleServerSideProcessing = async (link: string) => {
  setCurrentView(ViewState.ProcessingClient); // Or ViewState.ProcessingServer if distinct UI
  const initialStages: ProcessingStage[] = [ // Simpler stages for server path
    { name: 'ServerProcessing', weight: 0.5, currentProgress: 0, isIndeterminate: true },
    { name: 'Transcription', weight: 0.5, currentProgress: 0, isIndeterminate: true },
  ];
  setProcessingStages(initialStages);
  setOverallProgress(0);
  setIsIndeterminateProgress(true); 
  setCurrentStageMessage('Server is processing video link...');
  updateStageProgress('ServerProcessing', 0.1); // Initial conceptual progress

  try {
    const response = await processVideoLinkAction(link); // This is the yt-dlp version

    // Once response comes back, we assume server processing and transcription are done
    // or have moved to their final states based on response.
    updateStageProgress('ServerProcessing', 1); 
    
    if (response.success && response.data) {
      setTranscriptionData(response.data);
      setCurrentStageMessage('Transcription complete!');
      updateStageProgress('Transcription', 1); // This makes overallProgress 100%
      setIsIndeterminateProgress(false);
      setCurrentView(ViewState.ShowingResults);
    } else {
      throw new Error(response.error || "Server-side processing failed with no specific error message.");
    }

  } catch (error) {
    setIsIndeterminateProgress(false);
    console.error('MainPage: Server-side processing pipeline error:', error);
    setErrorMessage(`Processing Error: ${error instanceof Error ? error.message : String(error)}`);
    setCurrentView(ViewState.Error);
  }
};

  const resetToStart = useCallback(() => {
    if (transcriptionProgressIntervalRef.current) { // Clear interval on reset
      clearInterval(transcriptionProgressIntervalRef.current);
      transcriptionProgressIntervalRef.current = null;
    }
    setSelectedFile(null);
    setSubmittedLink(null);
    setStatusMessages([]);
    setCurrentStageMessage('');
    setProcessingStages([]);
    setOverallProgress(0);
    setErrorMessage(null);
    setTranscriptionData(null);
    setCurrentView(ViewState.SelectingInput);
  }, []);

  const updateStageProgress = useCallback((stageName: string, stageProgressVal: number) => {
    setProcessingStages(prevStages => {
        let calculatedOverallProgress = 0;
        const updatedStages = prevStages.map(stage => {
            const newStage = stage.name === stageName 
                ? { ...stage, currentProgress: Math.max(0, Math.min(1, stageProgressVal)) } 
                : stage;
            calculatedOverallProgress += newStage.weight * newStage.currentProgress;
            return newStage;
        });
        
        console.log(`[updateStageProgress] Stage: ${stageName}, StageProgress: ${stageProgressVal.toFixed(2)}, New OverallProgress: ${calculatedOverallProgress.toFixed(2)}`);
        setOverallProgress(calculatedOverallProgress);
        return updatedStages;
    });
  }, []);

  const handleClientSideProcessing = async (fileToProcess: File) => {
    if (!ffmpeg) {
      setErrorMessage("FFmpeg is not loaded. Cannot process.");
      setCurrentView(ViewState.Error);
      return;
    }
    
    console.log("Starting handleClientSideProcessing");
    setCurrentView(ViewState.ProcessingClient);
    const initialStages: ProcessingStage[] = [
      { name: 'AudioExtraction', weight: 0.5, currentProgress: 0, isIndeterminate: false },
      { name: 'Transcription', weight: 0.5, currentProgress: 0, isIndeterminate: true }, // Mark as indeterminate
    ];
    setProcessingStages(initialStages);
    setOverallProgress(0);
    setIsIndeterminateProgress(false); // Initial state for FFmpeg
    console.log("Set isIndeterminateProgress to false for FFmpeg");
    setCurrentStageMessage('Preparing for audio extraction...');

    try {
      // Stage 1: Audio Extraction
      setCurrentStageMessage('Extracting audio from video...');
      updateStageProgress('AudioExtraction', 0.01); 

      const audioBlob = await extractAudio({
          file: fileToProcess, outputFormat: 'opus',
          onLog: () => { /* ... */ },
          onProgress: (progVal) => {
              if (isIndeterminateProgress) setIsIndeterminateProgress(false); // Should be false here
              updateStageProgress('AudioExtraction', progVal);
              setCurrentStageMessage(`Extracting audio... ${Math.round(progVal * 100)}%`);
          },
      });
      updateStageProgress('AudioExtraction', 1); 
      setCurrentStageMessage('Audio extracted! Preparing for transcription...');
      console.log("FFmpeg extraction complete. Current overallProgress:", overallProgress); // Use a ref for latest value if needed

      // Stage 2: Transcription
      console.log("Setting isIndeterminateProgress to true for Transcription");
      setIsIndeterminateProgress(true); 
      setCurrentStageMessage('AI Transcribing... (this may take a few moments)');
      updateStageProgress('Transcription', 0.01); // Initial progress for transcription stage

      // Clear any existing interval just in case (belt and braces)
      if (transcriptionProgressIntervalRef.current) {
        clearInterval(transcriptionProgressIntervalRef.current);
      }

      // Simulate progress for transcription
      let transcriptionSimulatedProgress = 0;
      const SIMULATED_TRANSCRIPTION_DURATION_MS = 20000; // Estimate 30 seconds (adjust!)
      const PROGRESS_INTERVAL_MS = 250; // Update every 0.5 seconds
      const totalSteps = SIMULATED_TRANSCRIPTION_DURATION_MS / PROGRESS_INTERVAL_MS;
      let currentStep = 0;

      // Assign the interval ID to the ref
      transcriptionProgressIntervalRef.current = setInterval(() => {
        currentStep++;
        const maxSimulatedProgressForStage = Math.min(0.98, (totalSteps - 1) / totalSteps); 
        transcriptionSimulatedProgress = Math.min(maxSimulatedProgressForStage, currentStep / totalSteps);
        updateStageProgress('Transcription', transcriptionSimulatedProgress);
        // No setCurrentStageMessage needed here if it's already "AI Transcribing..."
    }, PROGRESS_INTERVAL_MS);
    
      const formData = new FormData();
      formData.append("audioBlob", audioBlob, `audio.${audioBlob.type.split('/')[1] || 'opus'}`); 
      console.log("Calling transcribeAudioAction...");
      const response = await transcribeAudioAction(formData);
      console.log("transcribeAudioAction returned. Clearing interval.");
      
      if (transcriptionProgressIntervalRef.current) {
          clearInterval(transcriptionProgressIntervalRef.current);
          transcriptionProgressIntervalRef.current = null;
      }
      console.log("Setting isIndeterminateProgress to false (Transcription complete or failed)");
      setIsIndeterminateProgress(false); 
      updateStageProgress('Transcription', 1); 
      
      if (response.success && response.data) {
        setTranscriptionData(response.data);
        setCurrentStageMessage('Transcription complete!');
        setCurrentView(ViewState.ShowingResults);
      } else {
        throw new Error(response.error || "Transcription failed with no specific error message.");
      }
    } catch (error) {
      if (transcriptionProgressIntervalRef.current) {
        clearInterval(transcriptionProgressIntervalRef.current);
        transcriptionProgressIntervalRef.current = null;
      }
      console.error('MainPage: Client-side processing pipeline error:', error);
      setIsIndeterminateProgress(false);
      setErrorMessage(`Processing Error: ${error instanceof Error ? error.message : String(error)}`);
      setCurrentView(ViewState.Error);
    }
  };

  // To get the most up-to-date overallProgress for logging inside async functions
  // if direct state access is stale due to closures:
  const overallProgressRef = useRef(overallProgress);
  useEffect(() => {
    overallProgressRef.current = overallProgress;
  }, [overallProgress]);

  // --- Handlers to transition between views ---
  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setSubmittedLink(null);
    setCurrentView(ViewState.ConfirmingInput);
  };

  const handleLinkSubmitted = (link: string) => {
    // For now, link submission will also go to confirmation, but Path B logic is TBD
    setSubmittedLink(link);
    setSelectedFile(null);
    setCurrentView(ViewState.ConfirmingInput);
    // Later, this might directly trigger a server-side processing path
  };

  const handleConfirmation = (chosenPath: 'client' | 'server') => {
    if (chosenPath === 'client') {
      if (selectedFile) {
        handleClientSideProcessing(selectedFile);
      } else if (submittedLink) {
        // Defaulting links to server-side processing
        console.log("Link submitted, initiating server-side processing for:", submittedLink);
        handleServerSideProcessing(submittedLink);
      }
    } else if (chosenPath === 'server') {
      if (selectedFile) { // Large file upload to server (Path B for files)
        setErrorMessage("Server-side processing for direct file uploads is not yet implemented.");
        setCurrentView(ViewState.Error);
      } else if (submittedLink) { // Link processing
        handleServerSideProcessing(submittedLink);
      }
    }
  };

  const handleCancelConfirmation = () => {
    resetToStart();
  };

  // --- Render logic for different views ---
  const renderCurrentView = () => {
    switch (currentView) {
      case ViewState.SelectingInput:
        return (
          <InputSelectionView
            onFileSelected={handleFileSelected}
            onLinkSubmitted={handleLinkSubmitted}
          />
        );
      case ViewState.ConfirmingInput:
        return (
          <ConfirmationView
            file={selectedFile}
            link={submittedLink}
            onConfirm={handleConfirmation}
            onCancel={handleCancelConfirmation}
          />
        );
      case ViewState.ProcessingClient:
        return (
          <ProcessingView
            currentStageMessage={currentStageMessage}
            overallProgress={overallProgress}
            isIndeterminate={isIndeterminateProgress}
          />
        );
      case ViewState.ShowingResults:
        if (transcriptionData) { // transcriptionData is DetailedTranscriptionResult | null
          return (
            <ResultsView 
              transcriptionData={transcriptionData} 
              onRestart={resetToStart} 
            />
          );
        }
        // Fallback if transcriptionData is somehow null
        setErrorMessage("Transcription data is missing when trying to show results.");
        setCurrentView(ViewState.Error); // Transition to error state
        return null; // Or <ViewStateRendererError />;

    case ViewState.Error:
      return <ViewStateRendererError />;
      
    default:
      return <p>Unknown application state.</p>;
    }
  };

  // Helper for error display
  const ViewStateRendererError = () => (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl max-w-lg mx-auto text-center">
      <h2 className="text-xl font-semibold text-red-600 mb-4">An Error Occurred</h2>
      <p className="text-slate-700 mb-6">{errorMessage || "An unspecified error occurred."}</p>
      <StyledButton onClick={resetToStart} variant="secondary">
        Try Again From Start
      </StyledButton>
    </div>
  );

  return <PageLayout>{renderCurrentView()}</PageLayout>;
}