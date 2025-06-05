// app/page.tsx
"use client";

import React, {useState, useCallback, useEffect} from "react";
import {Settings, Waves, FileText} from "lucide-react";

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

export type SelectedInputType = "video" | "audio" | "link"; // ADDED "audio"

enum ViewState {
  SelectingInput,
  ConfirmingInput,
  ProcessingClient,
  ProcessingServer,
  ShowingResults,
  Error,
}

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

  // Your existing error messages...
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
  if (lowerError.includes("file type error")) {
    // For the new error from handleFileSelected
    return rawErrorMessage; // Pass through the direct message
  }
  if (
    lowerError.includes("invalid data found when processing input") ||
    lowerError.includes("moov atom not found")
  ) {
    return "The provided file/link does not appear to point to a valid video/audio format, or it might be corrupted. Please try a different one.";
  }
  if (
    lowerError.includes("ffmpeg exited with code") &&
    !lowerError.includes("no audio track") &&
    !lowerError.includes("output file does not contain any stream")
  ) {
    return "Failed to process the file in your browser. The format might be unsupported, or the file could be corrupted. Consider the server processing option or a different file type.";
  }
  if (
    lowerError.includes("ffmpeg audio conversion failed") // From new client processor logic
  ) {
    return "Failed to convert the uploaded audio file in your browser. The format might be unsupported. Consider server processing or a different audio format (like Opus, MP3, WAV).";
  }
  // ... (rest of your YouTube, yt-dlp, Groq error messages)
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
  if (lowerError.includes("playlist")) {
    return "Playlists aren’t supported yet — please provide a link to a single video.";
  }
  if (
    lowerError.includes("groq api error (status: 413)") ||
    lowerError.includes("audio data is too large") ||
    lowerError.includes("content is too long for the selected model") // For tiktoken error
  ) {
    return "The extracted audio or provided content is too large for the transcription/AI service. Please try a shorter file or break it into smaller segments.";
  }
  if (
    lowerError.includes("groq api error") &&
    (lowerError.includes("(status: 503)") ||
      lowerError.includes("service unavailable"))
  ) {
    return "The transcription service is temporarily unavailable (Status 503). This usually means the service is very busy or undergoing maintenance. Please try again in a few minutes.";
  }
  if (
    (lowerError.includes("groq api error") ||
      lowerError.includes("transcription service encountered an issue")) &&
    !lowerError.includes("(status: 503)") &&
    !lowerError.includes("(status: 413)") &&
    !lowerError.includes("(status: 401)") // Avoid double-matching
  ) {
    return "The transcription service encountered a problem. Please try again in a few moments.";
  }
  if (
    lowerError.includes("connection error") ||
    lowerError.includes("econnreset") || // Specifically for ECONNRESET from transcribeAudioAction
    lowerError.includes("network error")
  ) {
    if (lowerError.includes("econnreset")) {
      return `A connection error (ECONNRESET) occurred while communicating with the transcription service. This can happen with large files or network interruptions. Please try a smaller file or check your connection. ${
        fileName ? `File: ${fileName}` : ""
      } ${fileSizeMB ? `(${fileSizeMB}MB)` : ""}`;
    }
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
  const [selectedInputType, setSelectedInputType] =
    useState<SelectedInputType | null>(null); // MODIFIED: Added

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

  const handleProcessingComplete = useCallback(
    (data: DetailedTranscriptionResult) => {
      setTranscriptionData(data);
      setCurrentOverallStatus("Transcription complete!");
      setCurrentView(ViewState.ShowingResults);
      setCurrentAppStepId("transcribe"); // Ensure step is updated
    },
    []
  );

  const handleError = useCallback(
    (ctx: string, msg: string, fn?: string, sz?: string) => {
      const friendlyMsg = getUserFriendlyErrorMessage(ctx, msg, fn, sz);
      console.error(
        `[App Error] Context: ${ctx}, Original: ${msg}, Friendly: ${friendlyMsg}`
      );
      setErrorMessage(friendlyMsg);
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
      setProcessingUIStages((prevStages) =>
        typeof s === "function" ? s(prevStages) : [...s]
      );
    },
    []
  );

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

  useEffect(() => {
    if (ffmpeg || typeof window === "undefined") return; // If already loaded or on server, skip
    console.log(
      "[Page.tsx] Attempting to load FFmpeg instance via getFFmpegInstance..."
    );
    getFFmpegInstance(
      (logMsg) => console.log("PageFFmpegLoad Log:", logMsg), // More specific log prefix
      (progress) => console.log("PageFFmpegLoad Progress:", progress)
    )
      .then((loadedFfmpegInstance) => {
        if (loadedFfmpegInstance) {
          // The .load() within getFFmpegInstance has completed successfully if we reach here.
          // We assume the instance is ready.
          console.log(
            "[Page.tsx] getFFmpegInstance resolved. Setting FFmpeg instance in state."
          );

          // Diagnostic log for isLoaded status
          if (typeof loadedFfmpegInstance.isLoaded === "function") {
            console.log(
              `[Page.tsx] Diagnostic: loadedFfmpegInstance.isLoaded() reports: ${loadedFfmpegInstance.isLoaded()}`
            );
          } else {
            console.log(
              "[Page.tsx] Diagnostic: loadedFfmpegInstance.isLoaded is not available on this instance."
            );
          }
          setFfmpeg(loadedFfmpegInstance);
        } else {
          // This path should ideally not be hit if getFFmpegInstance always returns an instance or throws.
          console.error(
            "[Page.tsx] getFFmpegInstance resolved but did not return a valid instance."
          );
          handleError(
            "FFmpeg Load",
            "Failed to obtain a valid FFmpeg instance."
          );
        }
      })
      .catch((e) => {
        console.error("[Page.tsx] Error during FFmpeg WASM loading:", e);
        handleError(
          "FFmpeg Load",
          `FFmpeg WASM failed to load: ${
            e instanceof Error ? e.message : String(e)
          }`
        );
      });
  }, [ffmpeg, handleError]);

  const resetToStart = useCallback(() => {
    setSelectedFile(null);
    setSubmittedLink(null);
    setSelectedInputType(null); // MODIFIED: Reset
    setCurrentOverallStatus("");
    setProcessingUIStages([]);
    setErrorMessage(null);
    setTranscriptionData(null);
    setCurrentView(ViewState.SelectingInput);
    setCurrentAppStepId("configure"); // MODIFIED: Reset step
  }, []);

  const handleFileSelected = (file: File) => {
    // MODIFIED
    setSelectedFile(file);
    setSubmittedLink(null);
    if (file.type.startsWith("audio/")) {
      setSelectedInputType("audio");
    } else if (file.type.startsWith("video/")) {
      setSelectedInputType("video");
    } else {
      // This case should be rare due to InputSelectionView's validation,
      // but it's a good fallback.
      handleError(
        "File Type Error",
        `Unsupported file type: ${file.type}. Please select a valid video or audio file.`
      );
      return; // Important to return here so we don't proceed to ConfirmationView
    }
    setCurrentAppStepId("configure"); // Ensure we are back at configure step
    setCurrentView(ViewState.ConfirmingInput);
  };

  const handleLinkSubmitted = (link: string) => {
    setSubmittedLink(link);
    setSelectedFile(null);
    setSelectedInputType("link");
    setCurrentAppStepId("configure");
    setCurrentView(ViewState.ConfirmingInput);
  };

  const handleConfirmation = (
    processingPath: "client" | "server",
    mode: TranscriptionMode
  ) => {
    setSelectedMode(mode);
    // setCurrentAppStepId("process"); // This is now set within each processor hook via onStepChange

    if (selectedInputType === "link" && submittedLink) {
      setCurrentView(ViewState.ProcessingServer);
      processServerLink(submittedLink, mode);
    } else if (selectedFile && selectedInputType) {
      const isAudio = selectedInputType === "audio";
      if (processingPath === "client") {
        // <<< Path for "Process in Browser"
        setCurrentView(ViewState.ProcessingClient);
        processClientFile(selectedFile, mode, isAudio); // Should call THIS
      } else {
        // processingPath === "server"
        setCurrentView(ViewState.ProcessingServer);
        processServerUploadedFile(selectedFile, mode, isAudio); // NOT this for client path
      }
    } else {
      console.error(
        "Confirmation error: No valid input (file/link and type) found."
      );
      handleError(
        "Confirmation Error",
        "No valid input found for processing. Please try selecting your input again."
      );
    }
  };

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
            inputType={selectedInputType} // MODIFIED: Pass inputType
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
            <p className="text-slate-700 mb-6 break-words">
              {" "}
              {/* Added break-words */}
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
