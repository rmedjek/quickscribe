// app/page.tsx
"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import PageLayout from '@/components/PageLayout';
import InputSelectionView from '@/components/InputSelectionView';
import ConfirmationView from '@/components/ConfirmationView';
import ProcessingView from '@/components/ProcessingView';
import StyledButton from '@/components/StyledButton';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { DetailedTranscriptionResult, transcribeAudioAction } from './actions/transcribeAudioAction';
import { extractAudio, getFFmpegInstance } from './lib/ffmpeg-utils';
import ResultsView from './components/ResultsView';
import { processVideoLinkAction } from '@/actions/processVideoLinkAction';
import { processLargeVideoFileAction } from './actions/processLargeVideoFileAction';

enum ViewState {
  SelectingInput,
  ConfirmingInput,
  ProcessingClient,
  ProcessingServer, // Unified state for server-side processing
  ShowingResults,
  Error,
}

interface ProcessingStage {
  name: string;
  weight: number;
  currentProgress: number;
}

// Adjusted estimated durations for the *entire server action*
const ESTIMATED_SERVER_LINK_ACTION_TOTAL_MS = 75000; // e.g., 75s for link processing (yt-dlp + ffmpeg + groq)
const ESTIMATED_SERVER_FILE_ACTION_TOTAL_MS = 90000; // e.g., 90s for large file (upload + ffmpeg + groq)
// For client-side path's Groq call simulation
const SIMULATED_CLIENT_TRANSCRIPTION_DURATION_MS = 20000; 
const PROGRESS_INTERVAL_MS = 250;

export default function HomePage() {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.SelectingInput);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submittedLink, setSubmittedLink] = useState<string | null>(null);
  const [ffmpeg, setFfmpeg] = useState<FFmpeg | null>(null);
  // statusMessages can be removed if not used for a detailed log list
  // const [, setStatusMessages] = useState<string[]>([]); 
  const [currentStageMessage, setCurrentStageMessage] = useState<string>('');
  const [, setProcessingStages] = useState<ProcessingStage[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isIndeterminateProgress, setIsIndeterminateProgress] = useState(false);
  const [transcriptionData, setTranscriptionData] = useState<DetailedTranscriptionResult | null>(null);
  
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const conceptualMessageTimeout1Ref = useRef<NodeJS.Timeout | null>(null);
  const conceptualMessageTimeout2Ref = useRef<NodeJS.Timeout | null>(null);


  useEffect(() => {
    async function loadFFmpeg() { /* ... same as before ... */ 
      try {
        console.log("MainPage: Initializing FFmpeg...");
        const instance = await getFFmpegInstance(
          (logMsg) => console.log('[FFMPEG CORE LOG - MainPage]:', logMsg),
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
  
  useEffect(() => { // Universal cleanup for all intervals/timeouts
    return () => {
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
      if (conceptualMessageTimeout1Ref.current) clearTimeout(conceptualMessageTimeout1Ref.current);
      if (conceptualMessageTimeout2Ref.current) clearTimeout(conceptualMessageTimeout2Ref.current);
    };
  }, []);

  const clearAllTimers = () => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    if (conceptualMessageTimeout1Ref.current) {
      clearTimeout(conceptualMessageTimeout1Ref.current);
      conceptualMessageTimeout1Ref.current = null;
    }
    if (conceptualMessageTimeout2Ref.current) {
      clearTimeout(conceptualMessageTimeout2Ref.current);
      conceptualMessageTimeout2Ref.current = null;
    }
  };

  const runSimulatedOverallProgress = (
    stageNameForWeight: string, // The single stage whose weight is 1.0 for this simulation
    estimatedTotalDurationMs: number,
  ) => {
    clearAllTimers(); // Clear any previous simulation
    let currentStep = 0;
    const totalSteps = estimatedTotalDurationMs / PROGRESS_INTERVAL_MS;
    
    // Ensure the stage exists with progress 0.01 to kickstart overallProgress calc
    updateStageProgress(stageNameForWeight, 0.01); 

    simulationIntervalRef.current = setInterval(() => {
      currentStep++;
      const maxSimProgress = Math.min(0.98, (totalSteps - 1) / totalSteps); 
      const simulatedProgress = Math.min(maxSimProgress, currentStep / totalSteps);
      updateStageProgress(stageNameForWeight, simulatedProgress);

      if (currentStep >= totalSteps) { // Simulation time elapsed
        clearAllTimers();
        // Actual completion will set progress to 1.0
      }
    }, PROGRESS_INTERVAL_MS);
  };

  const resetToStart = useCallback(() => {
    clearAllTimers();
    setSelectedFile(null); setSubmittedLink(null); /* setStatusMessages([]); */ 
    setCurrentStageMessage(''); setProcessingStages([]); setOverallProgress(0);
    setErrorMessage(null); setTranscriptionData(null); setIsIndeterminateProgress(false);
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
        setOverallProgress(calculatedOverallProgress);
        return updatedStages;
    });
  }, []);

  const handleClientSideProcessing = async (fileToProcess: File) => {
    if (!ffmpeg) { /* ... error ... */ return; }
    setCurrentView(ViewState.ProcessingClient);
    const stages: ProcessingStage[] = [
      { name: 'AudioExtraction', weight: 0.5, currentProgress: 0 },
      { name: 'TranscriptionClient', weight: 0.5, currentProgress: 0 }, // Unique name for this stage
    ];
    setProcessingStages(stages);
    setOverallProgress(0);
    setIsIndeterminateProgress(false); 
    setCurrentStageMessage('Preparing for audio extraction...');

    try {
      setCurrentStageMessage('Extracting audio from video...');
      updateStageProgress('AudioExtraction', 0.01);
      const audioBlob = await extractAudio({
        file: fileToProcess, outputFormat: 'opus',
        onLog: (logMsg) => console.log('[FFMPEG_CLIENT_LOG]', logMsg),
        onProgress: (progVal) => {
          updateStageProgress('AudioExtraction', progVal);
          setCurrentStageMessage(`Extracting audio... ${Math.round(progVal * 100)}%`);
        },
      });
      updateStageProgress('AudioExtraction', 1);
      setCurrentStageMessage('Audio extracted! Sending to AI...');
      
      setIsIndeterminateProgress(true); 
      setCurrentStageMessage('AI Transcribing (client path)...');
      runSimulatedOverallProgress('TranscriptionClient', SIMULATED_CLIENT_TRANSCRIPTION_DURATION_MS);
      
      const formData = new FormData();
      formData.append("audioBlob", audioBlob, `audio.${audioBlob.type.split('/')[1] || 'opus'}`);
      const response = await transcribeAudioAction(formData);
      
      clearAllTimers();
      setIsIndeterminateProgress(false);
      updateStageProgress('TranscriptionClient', 1);

      if (response.success && response.data) {
        setTranscriptionData(response.data);
        setCurrentStageMessage('Transcription complete!');
        setCurrentView(ViewState.ShowingResults);
      } else { throw new Error(response.error || "Client-side transcription pipeline failed."); }
    } catch (error) { 
        clearAllTimers();
        setIsIndeterminateProgress(false);
        console.error('MainPage: Client-side processing error:', error);
        setErrorMessage(`Processing Error: ${error instanceof Error ? error.message : String(error)}`);
        setCurrentView(ViewState.Error);
    }
  };

  const handleServerSideLinkProcessing = async (link: string) => {
    setCurrentView(ViewState.ProcessingServer);
    const stages: ProcessingStage[] = [
      { name: 'ServerLinkProcess', weight: 1.0, currentProgress: 0 },
    ];
    setProcessingStages(stages);
    setOverallProgress(0);
    setIsIndeterminateProgress(true); 
    setCurrentStageMessage('Server: Requesting video link processing...');
    
    runSimulatedOverallProgress('ServerLinkProcess', ESTIMATED_SERVER_LINK_ACTION_TOTAL_MS);

    // Conceptual message updates
    conceptualMessageTimeout1Ref.current = setTimeout(() => setCurrentStageMessage('Server: Downloading & preparing audio...'), ESTIMATED_SERVER_LINK_ACTION_TOTAL_MS * 0.1);
    conceptualMessageTimeout2Ref.current = setTimeout(() => setCurrentStageMessage('Server: AI Transcribing...'), ESTIMATED_SERVER_LINK_ACTION_TOTAL_MS * 0.5);

    try {
      const response = await processVideoLinkAction(link); 
      clearAllTimers();
      
      if (response.success && response.data) {
        setTranscriptionData(response.data);
        setCurrentStageMessage('Transcription complete!');
        updateStageProgress('ServerLinkProcess', 1); 
        setIsIndeterminateProgress(false);
        setCurrentView(ViewState.ShowingResults);
      } else {
        throw new Error(response.error || "Server-side link processing failed.");
      }
    } catch (error) { 
        clearAllTimers();
        setIsIndeterminateProgress(false);
        console.error('MainPage: Server-side link processing error:', error);
        setErrorMessage(`Processing Error: ${error instanceof Error ? error.message : String(error)}`);
        setCurrentView(ViewState.Error);
    }
  };

  const handleServerSideFileUploadProcessing = async (fileToProcess: File) => {
    setCurrentView(ViewState.ProcessingServer);
    const stages: ProcessingStage[] = [
      { name: 'ServerFileProcess', weight: 1.0, currentProgress: 0 },
    ];
    setProcessingStages(stages);
    setOverallProgress(0);
    setIsIndeterminateProgress(true); 
    setCurrentStageMessage('Server: Uploading and processing file...');
    
    runSimulatedOverallProgress('ServerFileProcess', ESTIMATED_SERVER_FILE_ACTION_TOTAL_MS);

    conceptualMessageTimeout1Ref.current = setTimeout(() => setCurrentStageMessage('Server: Extracting audio from uploaded file...'), ESTIMATED_SERVER_FILE_ACTION_TOTAL_MS * 0.2);
    conceptualMessageTimeout2Ref.current = setTimeout(() => setCurrentStageMessage('Server: AI Transcribing...'), ESTIMATED_SERVER_FILE_ACTION_TOTAL_MS * 0.6);

    try {
      const formData = new FormData();
      formData.append("videoFile", fileToProcess);
      const response = await processLargeVideoFileAction(formData);
      clearAllTimers();

      if (response.success && response.data) {
        setTranscriptionData(response.data);
        setCurrentStageMessage('Transcription complete!');
        updateStageProgress('ServerFileProcess', 1);
        setIsIndeterminateProgress(false);
        setCurrentView(ViewState.ShowingResults);
      } else {
        throw new Error(response.error || "Server-side file processing failed.");
      }
    } catch (error) { 
        clearAllTimers();
        setIsIndeterminateProgress(false);
        console.error('MainPage: Server-side file upload processing error:', error);
        setErrorMessage(`Processing Error: ${error instanceof Error ? error.message : String(error)}`);
        setCurrentView(ViewState.Error);
    }
  };

  const handleFileSelected = (file: File) => { /* ... same as before ... */ 
    setSelectedFile(file); setSubmittedLink(null); setCurrentView(ViewState.ConfirmingInput);
  };
  const handleLinkSubmitted = (link: string) => { /* ... same as before ... */ 
    setSubmittedLink(link); setSelectedFile(null); setCurrentView(ViewState.ConfirmingInput);
  };
  const handleConfirmation = (chosenPath: 'client' | 'server') => { /* ... same as before, calling new handlers ... */ 
    if (!ffmpeg && chosenPath === 'client' && selectedFile) {
        setErrorMessage("FFmpeg is not ready. Please wait or refresh.");
        setCurrentView(ViewState.Error); return;
    }
    if (chosenPath === 'client') {
      if (selectedFile) { handleClientSideProcessing(selectedFile); } 
      else if (submittedLink) { 
        setErrorMessage("Client-side processing of video links is not supported.");
        setCurrentView(ViewState.Error);
      }
    } else if (chosenPath === 'server') {
      if (selectedFile) { handleServerSideFileUploadProcessing(selectedFile); } 
      else if (submittedLink) { handleServerSideLinkProcessing(submittedLink); }
      else { setErrorMessage("No input provided for server processing."); setCurrentView(ViewState.Error); }
    }
  };
  const handleCancelConfirmation = () => { resetToStart(); };
  
  const ViewStateRendererError = () => ( /* ... same as before ... */ 
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl max-w-lg mx-auto text-center">
      <h2 className="text-xl font-semibold text-red-600 mb-4">An Error Occurred</h2>
      <p className="text-slate-700 mb-6">{errorMessage || "An unspecified error occurred."}</p>
      <StyledButton onClick={resetToStart} variant="secondary"> Start Over </StyledButton>
    </div>
  );

  const renderCurrentView = () => { /* ... same as before with corrected ProcessingServer case ... */ 
    switch (currentView) {
      case ViewState.SelectingInput:
        return <InputSelectionView onFileSelected={handleFileSelected} onLinkSubmitted={handleLinkSubmitted} />;
      case ViewState.ConfirmingInput:
        return <ConfirmationView file={selectedFile} link={submittedLink} onConfirm={handleConfirmation} onCancel={handleCancelConfirmation} />;
      case ViewState.ProcessingClient:
      case ViewState.ProcessingServer: 
        return (
          <ProcessingView
            currentStageMessage={currentStageMessage}
            overallProgress={overallProgress}
            isIndeterminate={isIndeterminateProgress}
          />
        );
      case ViewState.ShowingResults:
        if (transcriptionData) {
          return <ResultsView transcriptionData={transcriptionData} onRestart={resetToStart} />;
        }
        setErrorMessage("Results data is missing."); 
        setCurrentView(ViewState.Error); 
        return null; 
      case ViewState.Error:
        return <ViewStateRendererError />;
      default:
        console.error(">>> HITTING DEFAULT CASE in renderCurrentView. currentView is:", currentView, "String name:", ViewState[currentView]);
        return <p>Unknown application state. (currentView value: {String(currentView)})</p>;
    }
  };

  return <PageLayout>{renderCurrentView()}</PageLayout>;
}