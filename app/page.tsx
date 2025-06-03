// app/page.tsx
"use client";

import React, {useState, useCallback, useEffect} from "react";
import {Settings, Waves, FileText} from "lucide-react"; /* ✔ */

import PageLayout from "@/components/PageLayout";
import InputSelectionView from "@/components/InputSelectionView";
import ConfirmationView, {
  TranscriptionMode,
} from "@/components/ConfirmationView";
import ProcessingView, {StageDisplayData} from "@/components/ProcessingView";
import ResultsView from "@/components/ResultsView";
import StyledButton from "@/components/StyledButton";

import {FFmpeg} from "@ffmpeg/ffmpeg";
import {getFFmpegInstance} from "@/lib/ffmpeg-utils";
import {DetailedTranscriptionResult} from "@/actions/transcribeAudioAction";

import {useServerLinkProcessor} from "./hooks/useServerLinkProcessor";
import {useClientFileProcessor} from "./hooks/useClientFileProcessor";
import {useServerFileUploadProcessor} from "./hooks/useServerFileUploadProcessor";

/* ------------ step order: Configure → Process Audio → Transcribe --- */
export interface AppStep {
  id: "configure" | "process" | "transcribe";
  name: string;
  icon: React.ElementType;
}
const APP_STEPS: AppStep[] = [
  {id: "configure", name: "Configure", icon: Settings},
  {id: "process", name: "Process Audio", icon: Waves},
  {id: "transcribe", name: "Get Transcripts", icon: FileText},
];

/* ---------------------------- view enum --------------------------- */
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

/* ================================================================== */
export default function HomePage() {
  /* --------------------------------------------------------------- */
  const [currentView, setCurrentView] = useState<ViewState>(
    ViewState.SelectingInput
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submittedLink, setSubmittedLink] = useState<string | null>(null);

  const [ffmpeg, setFfmpeg] = useState<FFmpeg | null>(null);
  const [selectedMode, setSelectedMode] = useState<TranscriptionMode>("chill");

  const [currentOverallStatus, setCurrentOverallStatus] = useState("");
  const [processingUIStages, setProcessingUIStages] = useState<
    StageDisplayData[]
  >([]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcriptionData, setTranscriptionData] =
    useState<DetailedTranscriptionResult | null>(null);
  const [currentAppStepId, setCurrentAppStepId] =
    useState<AppStep["id"]>("configure");

  /* --------------- callbacks shared by hooks --------------------- */
  const handleProcessingComplete = useCallback(
    (data: DetailedTranscriptionResult) => {
      setTranscriptionData(data);
      setCurrentOverallStatus("Transcription complete!");
      setCurrentView(ViewState.ShowingResults);
    },
    []
  );

  const handleError = useCallback(
    (ctx: string, msg: string, fn?: string, sz?: string) => {
      setErrorMessage(getUserFriendlyErrorMessage(ctx, msg, fn, sz));
      setCurrentView(ViewState.Error);
    },
    []
  );

  const handleStatusUpdate = useCallback(
    (m: string) => setCurrentOverallStatus(m),
    []
  );

  const handleStagesUpdate = useCallback(
    (
      s: StageDisplayData[] | ((p: StageDisplayData[]) => StageDisplayData[])
    ) => {
      if (typeof s === "function") {
        setProcessingUIStages(s);
      } else {
        setProcessingUIStages([...s]);
      }
    },
    []
  );

  /* --------------- processing hooks ------------------------------ */
  const {processFile: processClientFile} = useClientFileProcessor({
    ffmpeg,
    onProcessingComplete: handleProcessingComplete,
    onError: (m, f, sz) => handleError("Client File Processing", m, f, sz),
    onStatusUpdate: handleStatusUpdate,
    onStagesUpdate: handleStagesUpdate,
    onStepChange: setCurrentAppStepId,
  });

  const {processLink: processServerLink} = useServerLinkProcessor({
    onProcessingComplete: handleProcessingComplete,
    onError: (m) => handleError("Server Link Processing", m),
    onStatusUpdate: handleStatusUpdate,
    onStagesUpdate: handleStagesUpdate,
    onStepChange: setCurrentAppStepId,
  });

  const {processFile: processServerUploadedFile} = useServerFileUploadProcessor(
    {
      onProcessingComplete: handleProcessingComplete,
      onError: (m, f, sz) => handleError("Server File Upload", m, f, sz),
      onStatusUpdate: handleStatusUpdate,
      onStagesUpdate: handleStagesUpdate,
      onStepChange: setCurrentAppStepId,
    }
  );

  /* --------------- FFmpeg init ----------------------------------- */
  useEffect(() => {
    if (ffmpeg) return;
    getFFmpegInstance()
      .then(setFfmpeg)
      .catch((e) =>
        handleError("FFmpeg Load", e instanceof Error ? e.message : String(e))
      );
  }, [ffmpeg, handleError]);

  /* --------------- reset ----------------------------------------- */
  const resetToStart = useCallback(() => {
    setSelectedFile(null);
    setSubmittedLink(null);
    setCurrentOverallStatus("");
    setProcessingUIStages([]);
    setErrorMessage(null);
    setTranscriptionData(null);
    setCurrentView(ViewState.SelectingInput);
  }, []);

  /* --------------- UI handlers (unchanged except no step-state) -- */
  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setSubmittedLink(null);
    setCurrentView(ViewState.ConfirmingInput);
  };

  const handleLinkSubmitted = (link: string) => {
    setSubmittedLink(link);
    setSelectedFile(null);
    setCurrentView(ViewState.ConfirmingInput);
  };

  const handleConfirmation = (
    processingPath: "client" | "server",
    mode: TranscriptionMode
  ) => {
    setSelectedMode(mode);

    if (processingPath === "client" && selectedFile) {
      setCurrentView(ViewState.ProcessingClient);
      processClientFile(selectedFile, mode);
    } else if (processingPath === "server") {
      setCurrentView(ViewState.ProcessingServer);
      if (selectedFile) {
        processServerUploadedFile(selectedFile, mode);
      } else if (submittedLink) {
        processServerLink(submittedLink, mode);
      }
    }
  };

  /* --------------- renderCurrentView (step id is literal) -------- */
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
            onCancel={resetToStart}
          />
        );
      case ViewState.ProcessingClient:
      case ViewState.ProcessingServer:
        return (
          <ProcessingView
            stages={processingUIStages}
            currentOverallStatusMessage={currentOverallStatus}
            appSteps={APP_STEPS}
            currentAppStepId={currentAppStepId}
          />
        );
      case ViewState.ShowingResults:
        return (
          transcriptionData && (
            <ResultsView
              transcriptionData={transcriptionData}
              mode={selectedMode}
              onRestart={resetToStart}
            />
          )
        );
      case ViewState.Error:
        return (
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl max-w-lg mx-auto text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-4">
              An Error Occurred
            </h2>
            <p className="text-slate-700 mb-6">
              {errorMessage ?? "An unspecified error occurred."}
            </p>
            <StyledButton onClick={resetToStart} variant="secondary">
              Start Over
            </StyledButton>
          </div>
        );
      default:
        return null;
    }
  };

  return <PageLayout>{renderCurrentView()}</PageLayout>;
}
