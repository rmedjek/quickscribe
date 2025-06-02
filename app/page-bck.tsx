// app/page.tsx
"use client";

import React, {useState, useCallback, useEffect, useRef} from "react";
import PageLayout from "@/components/PageLayout";
import InputSelectionView from "@/components/InputSelectionView";
import ConfirmationView, {
  TranscriptionMode,
} from "@/components/ConfirmationView";
import ProcessingView from "@/components/ProcessingView";
import ResultsView from "@/components/ResultsView";
import StyledButton from "@/components/StyledButton";

import {FFmpeg} from "@ffmpeg/ffmpeg";
import {
  DetailedTranscriptionResult,
  transcribeAudioAction,
} from "@/actions/transcribeAudioAction";
import {extractAudio, getFFmpegInstance} from "@/lib/ffmpeg-utils";
import {processVideoLinkAction} from "@/actions/processVideoLinkAction";
import {processLargeVideoFileAction} from "@/actions/processLargeVideoFileAction";
import {FileText, Settings, UploadCloud} from "lucide-react";

enum ViewState {
  SelectingInput,
  ConfirmingInput,
  ProcessingClient,
  ProcessingServer,
  ShowingResults,
  Error,
}

interface ProcessingStage {
  name: string;
  weight: number;
  currentProgress: number;
}

const ESTIMATED_SERVER_LINK_ACTION_TOTAL_MS = 75000;
const ESTIMATED_SERVER_FILE_ACTION_TOTAL_MS = 90000; // Adjust if typical 500MB files take longer
const SIMULATED_CLIENT_TRANSCRIPTION_DURATION_MS = 20000;
const PROGRESS_INTERVAL_MS = 250;

// Define Stepper steps globally or pass to components
const APP_STEPS = [
  {id: "upload", name: "Upload Video", icon: UploadCloud}, // Assuming UploadCloud is imported
  {id: "settings", name: "Configure", icon: Settings}, // Assuming Settings is imported
  {id: "transcribe", name: "Get Transcripts", icon: FileText}, // Assuming FileText is imported
];

// --- Helper function for user-friendly error messages ---
const getUserFriendlyErrorMessage = (
  context: string,
  rawErrorMessage: string,
  fileName?: string,
  fileSizeMB?: string
): string => {
  console.log(
    `[getUserFriendlyErrorMessage] Context: ${context}, Raw Error: "${rawErrorMessage}"`
  );
  const lowerError = rawErrorMessage.toLowerCase();

  // Display variable for the server limit
  const serverLimitForDisplay =
    process.env.SERVER_ACTION_BODY_LIMIT_CONFIG ||
    "the configured server limit";

  if (
    context === "Server File Upload" &&
    (lowerError.includes("body exceeded") ||
      lowerError.includes("payload too large") ||
      // Heuristic for "unexpected response" when a large file is likely the cause
      (lowerError.includes(
        "an unexpected response was received from the server"
      ) &&
        fileSizeMB &&
        Number(fileSizeMB) > parseInt(serverLimitForDisplay) * 0.9))
  ) {
    return `The uploaded file (${
      fileName || "Selected file"
    }, ${fileSizeMB} MB) is too large for server processing. The current server limit is approximately ${serverLimitForDisplay}. Please try a smaller file.`;
  }

  // ... (other specific error checks remain the same) ...
  if (
    lowerError.includes("no audio track") ||
    lowerError.includes("output file does not contain any stream") ||
    lowerError.includes("extracted audio is empty")
  ) {
    return "It seems your video file doesn't have an audio track, or the audio couldn't be processed. Please check your file and try again.";
  }
  if (
    lowerError.includes("invalid data found when processing input") ||
    lowerError.includes("moov atom not found")
  ) {
    return "The provided file/link does not appear to point to a valid video format, or it might be corrupted. Please try a different one.";
  }
  if (
    lowerError.includes("ffmpeg exited with code") &&
    !lowerError.includes("no audio track") &&
    !lowerError.includes("output file does not contain any stream")
  ) {
    return "Failed to process the video in your browser. The format might be unsupported, or the file could be corrupted. Consider the server processing option or a different file type.";
  }
  if (
    lowerError.includes("incomplete youtube id") ||
    (lowerError.includes("yt-dlp") &&
      (lowerError.includes("video unavailable") ||
        lowerError.includes("403") ||
        lowerError.includes("404")))
  ) {
    return "The YouTube link seems to be invalid, private, or the video is no longer available. Please check the URL.";
  }
  if (lowerError.includes("yt-dlp failed")) {
    return "There was an issue downloading the video from the provided link. Please ensure the link is correct and the video is publicly accessible.";
  }
  if (lowerError.includes("failed to download video from direct link")) {
    return "Could not download content from the provided link. Please ensure the URL is correct and publicly accessible.";
  }
  if (
    lowerError.includes("groq api error (status: 401)") ||
    lowerError.includes("invalid api key")
  ) {
    return "The transcription service is currently experiencing issues. Please try again later. (Auth Error)";
  }
  if (
    lowerError.includes("groq api error (status: 413)") ||
    lowerError.includes("audio data is too large")
  ) {
    // This specific check refers to Groq's limit on the *audio* data, not the initial video upload.
    return "The extracted audio data is too large for the transcription service. Please try a shorter video.";
  }
  if (
    lowerError.includes("groq api error") ||
    lowerError.includes("transcription service encountered an issue")
  ) {
    return "The transcription service encountered a problem. Please try again in a few moments.";
  }
  if (
    lowerError.includes("connection error") ||
    lowerError.includes("econnreset") ||
    lowerError.includes("network error")
  ) {
    return "A network connection issue occurred. Please check your internet connection and try again.";
  }
  // Fallback for generic server errors that weren't body size limit
  if (
    lowerError.includes("an unexpected response was received from the server")
  ) {
    return "The server encountered an issue while processing your request, or the connection was lost. Please try again.";
  }

  console.warn(
    `[getUserFriendlyErrorMessage] Unhandled error type for context "${context}", showing generic message. Original error for dev:`,
    rawErrorMessage
  );
  return "Oops! Something went wrong during processing. Please try again. If the problem continues, the file might be unsuitable.";
};

export default function HomePage() {
  const [currentView, setCurrentView] = useState<ViewState>(
    ViewState.SelectingInput
  );
  const [, setSelectedTranscriptionMode] = useState<TranscriptionMode>("turbo");
  const [, setCurrentStepperStepId] = useState<string>(APP_STEPS[0].id); // Start at first step
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submittedLink, setSubmittedLink] = useState<string | null>(null);
  const [ffmpeg, setFfmpeg] = useState<FFmpeg | null>(null);
  const [currentStageMessage, setCurrentStageMessage] = useState<string>("");
  const [, setProcessingStages] = useState<ProcessingStage[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isIndeterminateProgress, setIsIndeterminateProgress] = useState(false);
  const [transcriptionData, setTranscriptionData] =
    useState<DetailedTranscriptionResult | null>(null);

  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const conceptualMessageTimeout1Ref = useRef<NodeJS.Timeout | null>(null);
  const conceptualMessageTimeout2Ref = useRef<NodeJS.Timeout | null>(null);

  // Load FFmpeg
  useEffect(() => {
    async function loadFFmpeg() {
      try {
        console.log("MainPage: Initializing FFmpeg...");
        const instance = await getFFmpegInstance((logMsg) =>
          console.log("[FFMPEG CORE LOG - MainPage]:", logMsg)
        );
        setFfmpeg(instance);
        console.log("MainPage: FFmpeg instance ready.");
      } catch (error) {
        console.error("MainPage: Failed to load FFmpeg on init:", error);
        const message = error instanceof Error ? error.message : String(error);
        setErrorMessage(
          getUserFriendlyErrorMessage(
            "FFmpeg Load",
            `Critical Error: Could not initialize FFmpeg. ${message}`
          )
        );
        setCurrentView(ViewState.Error);
      }
    }
    loadFFmpeg();
  }, []);

  // Universal timer cleanup
  useEffect(() => {
    return () => {
      if (simulationIntervalRef.current)
        clearInterval(simulationIntervalRef.current);
      if (conceptualMessageTimeout1Ref.current)
        clearTimeout(conceptualMessageTimeout1Ref.current);
      if (conceptualMessageTimeout2Ref.current)
        clearTimeout(conceptualMessageTimeout2Ref.current);
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
    stageNameForWeight: string,
    estimatedTotalDurationMs: number
  ) => {
    clearAllTimers();
    let currentStep = 0;
    const totalSteps = Math.max(
      1,
      estimatedTotalDurationMs / PROGRESS_INTERVAL_MS
    ); // Avoid division by zero
    updateStageProgress(stageNameForWeight, 0.01);

    simulationIntervalRef.current = setInterval(() => {
      currentStep++;
      const maxSimProgress = Math.min(
        0.98,
        totalSteps > 1 ? (totalSteps - 1) / totalSteps : 0.98
      );
      const simulatedProgress = Math.min(
        maxSimProgress,
        currentStep / totalSteps
      );
      updateStageProgress(stageNameForWeight, simulatedProgress);
      if (currentStep >= totalSteps) {
        clearAllTimers();
      }
    }, PROGRESS_INTERVAL_MS);
  };

  const resetToStart = useCallback(() => {
    clearAllTimers();
    setSelectedFile(null);
    setSubmittedLink(null);
    setCurrentStageMessage("");
    setProcessingStages([]);
    setOverallProgress(0);
    setErrorMessage(null);
    setTranscriptionData(null);
    setIsIndeterminateProgress(false);
    setSelectedTranscriptionMode("turbo");
    setCurrentStepperStepId(APP_STEPS[0].id);
    setCurrentView(ViewState.SelectingInput);
  }, []);

  const updateStageProgress = useCallback(
    (stageName: string, stageProgressVal: number) => {
      setProcessingStages((prevStages) => {
        const stagesToUpdate = prevStages.find((s) => s.name === stageName)
          ? prevStages
          : [...prevStages, {name: stageName, weight: 1.0, currentProgress: 0}]; // Add stage if not exists (for single stage sim)

        let calculatedOverallProgress = 0;
        const updatedStagesResult = stagesToUpdate.map((stage) => {
          const newStage =
            stage.name === stageName
              ? {
                  ...stage,
                  currentProgress: Math.max(0, Math.min(1, stageProgressVal)),
                }
              : stage;
          calculatedOverallProgress +=
            newStage.weight * newStage.currentProgress;
          return newStage;
        });
        setOverallProgress(calculatedOverallProgress);
        return updatedStagesResult;
      });
    },
    []
  );

  const handleClientSideProcessing = async (
    fileToProcess: File,
    mode: TranscriptionMode
  ) => {
    console.log(`Client processing with mode: ${mode}`);
    setCurrentStepperStepId(APP_STEPS[2].id); // Move to 'Transcribe' step conceptually
    if (!ffmpeg) {
      setErrorMessage(
        getUserFriendlyErrorMessage(
          "Client File Processing",
          "FFmpeg is not loaded."
        )
      );
      setCurrentView(ViewState.Error);
      return;
    }
    setCurrentView(ViewState.ProcessingClient);
    const stages: ProcessingStage[] = [
      {name: "AudioExtraction", weight: 0.5, currentProgress: 0},
      {name: "TranscriptionClient", weight: 0.5, currentProgress: 0},
    ];
    setProcessingStages(stages);
    setOverallProgress(0);
    setIsIndeterminateProgress(false);
    setCurrentStageMessage("Preparing for audio extraction...");
    try {
      setCurrentStageMessage("Extracting audio from video...");
      updateStageProgress("AudioExtraction", 0.01);
      const audioBlob = await extractAudio({
        file: fileToProcess,
        outputFormat: "opus",
        onLog: (logMsg) => console.log("[FFMPEG_CLIENT_LOG]", logMsg),
        onProgress: (progVal) => {
          updateStageProgress("AudioExtraction", progVal);
          setCurrentStageMessage(
            `Extracting audio... ${Math.round(progVal * 100)}%`
          );
        },
      });
      updateStageProgress("AudioExtraction", 1);
      setCurrentStageMessage("Audio extracted! Sending to AI...");
      setIsIndeterminateProgress(true);
      setCurrentStageMessage("AI Transcribing (client path)...");
      runSimulatedOverallProgress(
        "TranscriptionClient",
        SIMULATED_CLIENT_TRANSCRIPTION_DURATION_MS
      );
      const formData = new FormData();
      formData.append(
        "audioBlob",
        audioBlob,
        `audio.${audioBlob.type.split("/")[1] || "opus"}`
      );
      const response = await transcribeAudioAction(formData, mode);
      clearAllTimers();
      setIsIndeterminateProgress(false);
      updateStageProgress("TranscriptionClient", 1);
      if (response.success && response.data) {
        setTranscriptionData(response.data);
        setCurrentStageMessage("Transcription complete!");
        setCurrentView(ViewState.ShowingResults);
      } else {
        throw new Error(
          response.error || "Client-side transcription pipeline failed."
        );
      }
    } catch (error) {
      clearAllTimers();
      setIsIndeterminateProgress(false);
      const originalErrorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        "MainPage: Client-side processing error:",
        originalErrorMessage
      );
      setErrorMessage(
        getUserFriendlyErrorMessage(
          "Client File Processing",
          originalErrorMessage,
          fileToProcess?.name,
          fileToProcess
            ? (fileToProcess.size / (1024 * 1024)).toFixed(2)
            : undefined
        )
      );
      setCurrentView(ViewState.Error);
    }
  };

  const handleServerSideLinkProcessing = async (
    link: string,
    mode: TranscriptionMode
  ) => {
    console.log(`Server link processing with mode: ${mode}`);
    setCurrentStepperStepId(APP_STEPS[2].id);
    setCurrentView(ViewState.ProcessingServer);
    const stages: ProcessingStage[] = [
      {name: "ServerLinkProcess", weight: 1.0, currentProgress: 0},
    ];
    setProcessingStages(stages);
    setOverallProgress(0);
    setIsIndeterminateProgress(true);
    setCurrentStageMessage("Server: Requesting video link processing...");
    runSimulatedOverallProgress(
      "ServerLinkProcess",
      ESTIMATED_SERVER_LINK_ACTION_TOTAL_MS
    );
    conceptualMessageTimeout1Ref.current = setTimeout(
      () => setCurrentStageMessage("Server: Downloading & preparing audio..."),
      ESTIMATED_SERVER_LINK_ACTION_TOTAL_MS * 0.1
    );
    conceptualMessageTimeout2Ref.current = setTimeout(
      () => setCurrentStageMessage("Server: AI Transcribing..."),
      ESTIMATED_SERVER_LINK_ACTION_TOTAL_MS * 0.5
    );
    try {
      const response = await processVideoLinkAction(link, mode);
      clearAllTimers();
      if (response.success && response.data) {
        setTranscriptionData(response.data);
        setCurrentStageMessage("Transcription complete!");
        updateStageProgress("ServerLinkProcess", 1);
        setIsIndeterminateProgress(false);
        setCurrentView(ViewState.ShowingResults);
      } else {
        throw new Error(
          response.error || "Server-side link processing failed."
        );
      }
    } catch (error) {
      clearAllTimers();
      setIsIndeterminateProgress(false);
      const originalErrorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        "MainPage: Server-side link processing error:",
        originalErrorMessage
      );
      setErrorMessage(
        getUserFriendlyErrorMessage(
          "Server Link Processing",
          originalErrorMessage
        )
      );
      setCurrentView(ViewState.Error);
    }
  };

  const handleServerSideFileUploadProcessing = async (
    fileToProcess: File,
    mode: TranscriptionMode
  ) => {
    console.log(`Server file processing with mode: ${mode}`);
    setCurrentStepperStepId(APP_STEPS[2].id); // Move to 'Transcribe' step
    setCurrentView(ViewState.ProcessingServer);
    const stages: ProcessingStage[] = [
      {name: "ServerFileProcess", weight: 1.0, currentProgress: 0},
    ];
    setProcessingStages(stages);
    setOverallProgress(0);
    setIsIndeterminateProgress(true);
    setCurrentStageMessage("Server: Uploading and processing file...");
    runSimulatedOverallProgress(
      "ServerFileProcess",
      ESTIMATED_SERVER_FILE_ACTION_TOTAL_MS
    );
    conceptualMessageTimeout1Ref.current = setTimeout(
      () => setCurrentStageMessage("Server: Extracting audio..."),
      ESTIMATED_SERVER_FILE_ACTION_TOTAL_MS * 0.2
    );
    conceptualMessageTimeout2Ref.current = setTimeout(
      () => setCurrentStageMessage("Server: AI Transcribing..."),
      ESTIMATED_SERVER_FILE_ACTION_TOTAL_MS * 0.6
    );
    try {
      const formData = new FormData();
      formData.append("videoFile", fileToProcess);
      const response = await processLargeVideoFileAction(formData, mode);
      clearAllTimers();
      if (response.success && response.data) {
        setTranscriptionData(response.data);
        setCurrentStageMessage("Transcription complete!");
        updateStageProgress("ServerFileProcess", 1);
        setIsIndeterminateProgress(false);
        setCurrentView(ViewState.ShowingResults);
      } else {
        throw new Error(
          response.error || "Server-side file processing failed."
        );
      }
    } catch (error) {
      clearAllTimers();
      setIsIndeterminateProgress(false);
      const originalErrorMessage =
        error instanceof Error ? error.message : String(error);
      const fileSizeMB = fileToProcess
        ? (fileToProcess.size / (1024 * 1024)).toFixed(2)
        : undefined; // Get file size
      const fileName = fileToProcess ? fileToProcess.name : undefined; // Get file name
      console.error(
        "MainPage: Server-side file upload processing error:",
        originalErrorMessage
      );
      setErrorMessage(
        getUserFriendlyErrorMessage(
          "Server File Upload",
          originalErrorMessage,
          fileName,
          fileSizeMB
        )
      );
      setCurrentView(ViewState.Error);
    }
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setSubmittedLink(null);
    setCurrentStepperStepId(APP_STEPS[1].id);
    setCurrentView(ViewState.ConfirmingInput);
  };
  const handleLinkSubmitted = (link: string) => {
    setSubmittedLink(link);
    setSelectedFile(null);
    setCurrentStepperStepId(APP_STEPS[1].id);
    setCurrentView(ViewState.ConfirmingInput);
  };
  const handleConfirmation = (
    chosenPath: "client" | "server",
    mode: TranscriptionMode
  ) => {
    setSelectedTranscriptionMode(mode); // Store the selected mode
    console.log(`Confirmation: Path - ${chosenPath}, Mode - ${mode}`);

    if (!ffmpeg && chosenPath === "client" && selectedFile) {
      setErrorMessage(
        getUserFriendlyErrorMessage(
          "Confirmation",
          "FFmpeg is not ready. Please wait or refresh."
        )
      );
      setCurrentView(ViewState.Error);
      return;
    }
    if (chosenPath === "client") {
      if (selectedFile) {
        handleClientSideProcessing(selectedFile, mode);
      } else if (submittedLink) {
        setErrorMessage(
          getUserFriendlyErrorMessage(
            "Confirmation",
            "Client-side processing of video links is not supported."
          )
        );
        setCurrentView(ViewState.Error);
      }
    } else if (chosenPath === "server") {
      if (selectedFile) {
        handleServerSideFileUploadProcessing(selectedFile, mode);
      } else if (submittedLink) {
        handleServerSideLinkProcessing(submittedLink, mode);
      } else {
        setErrorMessage(
          getUserFriendlyErrorMessage(
            "Confirmation",
            "No input (file or link) provided for server processing."
          )
        );
        setCurrentView(ViewState.Error);
      }
    }
  };
  const handleCancelConfirmation = () => {
    setCurrentStepperStepId(APP_STEPS[0].id); // Back to 'Upload'
    resetToStart();
  };

  const ViewStateRendererError = () => (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl max-w-lg mx-auto text-center">
      <h2 className="text-xl font-semibold text-red-600 mb-4">
        An Error Occurred
      </h2>
      <p className="text-slate-700 mb-6">
        {errorMessage || "An unspecified error occurred."}
      </p>
      <StyledButton onClick={resetToStart} variant="secondary">
        {" "}
        Start Over{" "}
      </StyledButton>
    </div>
  );

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
            currentStepIdForStepper={APP_STEPS[1].id}
          />
        );

      case ViewState.ProcessingClient:
      case ViewState.ProcessingServer:
        return (
          <ProcessingView
            currentStageMessage={currentStageMessage}
            overallProgress={overallProgress}
            isIndeterminate={isIndeterminateProgress}
            currentStepIdForStepper={APP_STEPS[2].id}
          />
        );
      case ViewState.ShowingResults:
        if (transcriptionData) {
          return (
            <ResultsView
              transcriptionData={transcriptionData}
              onRestart={resetToStart}
            />
          );
        }
        setErrorMessage(
          getUserFriendlyErrorMessage(
            "ShowingResults",
            "Results data is missing."
          )
        );
        setCurrentView(ViewState.Error);
        return null;
      case ViewState.Error:
        return <ViewStateRendererError />;
      default:
        console.error(
          ">>> HITTING DEFAULT CASE in renderCurrentView. currentView is:",
          currentView,
          "String name:",
          ViewState[currentView]
        );
        return (
          <p>
            Unknown application state. (currentView value: {String(currentView)}
            )
          </p>
        );
    }
  };

  return <PageLayout>{renderCurrentView()}</PageLayout>;
}
