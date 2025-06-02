// app/page.tsx
"use client";

import React, {useState, useCallback, useEffect} from "react";

// UI Components
import PageLayout from "@/components/PageLayout";
import InputSelectionView from "@/components/InputSelectionView";
import ConfirmationView, {
  TranscriptionMode,
} from "@/components/ConfirmationView";
import ProcessingView, {StageDisplayData} from "@/components/ProcessingView";
import ResultsView from "@/components/ResultsView";
import StyledButton from "@/components/StyledButton";

// FFmpeg & Actions & Utils
import {FFmpeg} from "@ffmpeg/ffmpeg";
import {getFFmpegInstance} from "@/lib/ffmpeg-utils"; // Only getFFmpegInstance needed here
import {DetailedTranscriptionResult} from "@/actions/transcribeAudioAction"; // Type from one of the actions

// Stepper
import {UploadCloud, Settings, FileText as TranscribeIcon} from "lucide-react";

// Hooks
import {useServerLinkProcessor} from "./hooks/useServerLinkProcessor";
import {useClientFileProcessor} from "./hooks/useClientFileProcessor";
import {useServerFileUploadProcessor} from "./hooks/useServerFileUploadProcessor";

// Assuming ProgressStepper's Step type is defined and exported, or define locally
interface AppStep {
  id: string;
  name: string;
  icon: React.ElementType;
}
const APP_STEPS: AppStep[] = [
  {id: "upload", name: "Select Input", icon: UploadCloud},
  {id: "settings", name: "Configure", icon: Settings},
  {id: "transcribe", name: "Get Transcripts", icon: TranscribeIcon},
];

// View States
enum ViewState {
  SelectingInput,
  ConfirmingInput,
  ProcessingClient,
  ProcessingServer,
  ShowingResults,
  Error,
}

// --- User-Friendly Error Message Helper ---
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
  const serverLimitForDisplay =
    process.env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_DISPLAY ||
    "the configured server limit";

  if (
    context === "Server File Upload" &&
    (lowerError.includes("body exceeded") ||
      lowerError.includes("payload too large") ||
      (lowerError.includes(
        "an unexpected response was received from the server"
      ) &&
        fileSizeMB &&
        Number(fileSizeMB) >
          parseInt(serverLimitForDisplay.replace(/[^0-9]/g, "")) * 0.9))
  ) {
    return `The uploaded file (${
      fileName || "Selected file"
    }, ${fileSizeMB} MB) is too large for server processing. The current server limit is approximately ${serverLimitForDisplay}. Please try a smaller file.`;
  }
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
    return "The extracted audio is too large for the transcription service. Please try a shorter video.";
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submittedLink, setSubmittedLink] = useState<string | null>(null);
  const [ffmpeg, setFfmpeg] = useState<FFmpeg | null>(null);
  const [, setSelectedTranscriptionMode] = useState<TranscriptionMode>("chill"); // Default mode

  // State for UI feedback during processing
  const [currentOverallStatus, setCurrentOverallStatus] = useState<string>("");
  const [processingUIStages, setProcessingUIStages] = useState<
    StageDisplayData[]
  >([]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcriptionData, setTranscriptionData] =
    useState<DetailedTranscriptionResult | null>(null);
  const [currentStepperStepId, setCurrentStepperStepId] = useState<string>(
    APP_STEPS[0].id
  );

  // --- Common Callbacks for Hooks ---
  const handleProcessingComplete = useCallback(
    (data: DetailedTranscriptionResult) => {
      setTranscriptionData(data);
      setCurrentOverallStatus("Transcription complete!"); // Final status
      // Individual stages should be marked complete by the hook via onStagesUpdate
      setCurrentView(ViewState.ShowingResults);
    },
    []
  );

  const handleError = useCallback(
    (
      context: string,
      errorMsg: string,
      fileName?: string,
      fileSizeMB?: string
    ) => {
      setErrorMessage(
        getUserFriendlyErrorMessage(context, errorMsg, fileName, fileSizeMB)
      );
      setCurrentView(ViewState.Error);
    },
    []
  );

  const handleStatusUpdate = useCallback((message: string) => {
    setCurrentOverallStatus(message);
  }, []);

  const handleStagesUpdate = useCallback(
    (
      stages:
        | StageDisplayData[]
        | ((prev: StageDisplayData[]) => StageDisplayData[])
    ) => {
      // Ensure functional updates are handled if hooks use them
      if (typeof stages === "function") {
        setProcessingUIStages(stages);
      } else {
        setProcessingUIStages([...stages]); // Create new array to ensure re-render
      }
    },
    []
  );

  // --- Instantiate Processing Hooks ---
  const {processFile: processClientFile, isProcessing: isClientProcessing} =
    useClientFileProcessor({
      ffmpeg: ffmpeg,
      onProcessingComplete: handleProcessingComplete,
      onError: (msg, fName, fSize) =>
        handleError("Client File Processing", msg, fName, fSize),
      onStatusUpdate: handleStatusUpdate,
      onStagesUpdate: handleStagesUpdate,
    });

  const {processLink: processServerLink, isProcessing: isServerLinkProcessing} =
    useServerLinkProcessor({
      onProcessingComplete: handleProcessingComplete,
      onError: (msg) => handleError("Server Link Processing", msg),
      onStatusUpdate: handleStatusUpdate,
      onStagesUpdate: handleStagesUpdate,
    });

  const {
    processFile: processServerUploadedFile,
    isProcessing: isServerFileProcessing,
  } = useServerFileUploadProcessor({
    onProcessingComplete: handleProcessingComplete,
    onError: (msg, fName, fSize) =>
      handleError("Server File Upload", msg, fName, fSize),
    onStatusUpdate: handleStatusUpdate,
    onStagesUpdate: handleStagesUpdate,
  });

  // --- FFmpeg Loading Effect ---
  useEffect(() => {
    async function loadFFmpegInstance() {
      if (ffmpeg) return; // Already loaded
      try {
        console.log("MainPage: Initializing FFmpeg...");
        const instance = await getFFmpegInstance((logMsg) =>
          console.log("[FFMPEG CORE LOG - MainPage]:", logMsg)
        );
        setFfmpeg(instance);
        console.log("MainPage: FFmpeg instance ready.");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        handleError(
          "FFmpeg Load",
          `Critical Error: Could not initialize FFmpeg. ${message}`
        );
      }
    }
    loadFFmpegInstance();
  }, [ffmpeg, handleError]); // Added handleError to dependency if it's stable via useCallback

  // --- Reset Logic ---
  const resetToStart = useCallback(() => {
    setSelectedFile(null);
    setSubmittedLink(null);
    setCurrentOverallStatus("");
    setProcessingUIStages([]);
    setErrorMessage(null);
    setTranscriptionData(null);
    setCurrentStepperStepId(APP_STEPS[0].id);
    setCurrentView(ViewState.SelectingInput);
    // Hooks might have internal timers; they should clean themselves up on unmount or via a reset function if exposed
  }, []);

  // --- UI Event Handlers ---
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
    processingPath: "client" | "server",
    mode: TranscriptionMode
  ) => {
    setCurrentStepperStepId(APP_STEPS[2].id);
    setSelectedTranscriptionMode(mode); // Store selected mode

    if (!ffmpeg && processingPath === "client" && selectedFile) {
      handleError(
        "Confirmation",
        "FFmpeg is not ready. Please wait or refresh."
      );
      return;
    }

    if (processingPath === "client") {
      if (selectedFile) {
        setCurrentView(ViewState.ProcessingClient);
        processClientFile(selectedFile, mode);
      } else if (submittedLink) {
        handleError(
          "Confirmation",
          "Client-side processing of video links is not supported."
        );
      }
    } else if (processingPath === "server") {
      if (selectedFile) {
        setCurrentView(ViewState.ProcessingServer);
        processServerUploadedFile(selectedFile, mode);
      } else if (submittedLink) {
        setCurrentView(ViewState.ProcessingServer);
        processServerLink(submittedLink, mode);
      } else {
        handleError(
          "Confirmation",
          "No input (file or link) provided for server processing."
        );
      }
    }
  };

  const handleCancelConfirmation = () => {
    setCurrentStepperStepId(APP_STEPS[0].id);
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
    // console.log("[renderCurrentView] Current ViewState:", currentView, " (Enum Name:", ViewState[currentView], ")");
    // console.log("[renderCurrentView] isClientProcessing:", isClientProcessing, "isServerLinkProcessing:", isServerLinkProcessing, "isServerFileProcessing:", isServerFileProcessing);

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
            currentStepIdForStepper={currentStepperStepId}
          />
        );
      case ViewState.ProcessingClient: // Intentionally fall through if UI is same
      case ViewState.ProcessingServer:
        // Determine if any processing hook is active for the indeterminate flag for ProcessingView
        // This assumes ProcessingView might still want a single isIndeterminate flag for its overall look
        // OR ProcessingView handles per-stage indeterminacy based on processingUIStages.
        // For now, let's assume ProcessingView uses per-stage data.
        return (
          <ProcessingView
            stages={processingUIStages}
            currentOverallStatusMessage={currentOverallStatus}
            appSteps={APP_STEPS}
            currentAppStepId={currentStepperStepId}
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
        handleError("ShowingResults", "Results data is missing."); // Call handleError to set state
        return null; // handleError will change view to Error, causing re-render
      case ViewState.Error:
        return <ViewStateRendererError />;
      default:
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
