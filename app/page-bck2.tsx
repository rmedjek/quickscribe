// app/page.tsx
"use client";

import React, {useState, useCallback, useEffect, useRef} from "react";
import PageLayout from "@/components/PageLayout";
import InputSelectionView from "@/components/InputSelectionView";
import ConfirmationView, {
  TranscriptionMode,
} from "@/components/ConfirmationView";
import ProcessingView, {StageDisplayData} from "@/components/ProcessingView"; // Import StageDisplayData
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
import {UploadCloud, Settings, FileText as TranscribeIcon} from "lucide-react"; // Import icons for stepper

enum ViewState {
  SelectingInput,
  ConfirmingInput,
  ProcessingClient,
  ProcessingServer,
  ShowingResults,
  Error,
}

const APP_STEPS = [
  {id: "upload", name: "Select Input", icon: UploadCloud},
  {id: "settings", name: "Configure", icon: Settings},
  {id: "transcribe", name: "Get Transcripts", icon: TranscribeIcon},
];

// --- DURATION CONSTANTS ---
const ESTIMATED_SERVER_LINK_ACTION_TOTAL_MS = 75000;
const ESTIMATED_SERVER_FILE_ACTION_TOTAL_MS = 90000;
const SIMULATED_CLIENT_TRANSCRIPTION_DURATION_MS = 20000;
const PROGRESS_INTERVAL_MS = 250;

const GROQ_AUDIO_LIMIT_BYTES = 24 * 1024 * 1024;

// --- Helper function for user-friendly error messages ---
const getUserFriendlyErrorMessage = (
  context: string,
  rawErrorMessage: string,
  fileName?: string,
  fileSizeMB?: string
): string => {
  // ... (Keep your full getUserFriendlyErrorMessage function here, as provided previously)
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
  const [currentOverallStatus, setCurrentOverallStatus] = useState<string>(""); // For ProcessingView top message
  const [processingUIStages, setProcessingUIStages] = useState<
    StageDisplayData[]
  >([]);
  // For ProcessingView individual bars
  // overallProgress state is no longer the primary driver for ProcessingView's main bar if it has stages
  // const [overallProgress, setOverallProgress] = useState(0); // Can be removed if not used elsewhere
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcriptionData, setTranscriptionData] =
    useState<DetailedTranscriptionResult | null>(null);

  // const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [currentStepperStepId, setCurrentStepperStepId] = useState<string>(
    APP_STEPS[0].id
  );

  const conceptualMessageTimeout1Ref = useRef<NodeJS.Timeout | null>(null); // Keep if using conceptual messages
  const conceptualMessageTimeout2Ref = useRef<NodeJS.Timeout | null>(null); // Keep if using conceptual messages
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    /* FFmpeg Load */
    async function loadFFmpeg() {
      try {
        const instance = await getFFmpegInstance((logMsg) =>
          console.log("[FFMPEG CORE LOG - MainPage]:", logMsg)
        );
        setFfmpeg(instance);
        console.log("MainPage: FFmpeg instance ready.");
      } catch (error) {
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

  useEffect(() => {
    /* Timer Cleanup */ return () => {
      if (simulationIntervalRef.current)
        clearInterval(simulationIntervalRef.current);
    };
  }, []);

  const clearSimulationInterval = () => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
  };

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

  // --- SIMULATED PROGRESS HELPER ---
  // This helper now simulates progress for ONE SPECIFIC UI STAGE
  const runSimulatedUIStageProgress = (
    stageName: string,
    estimatedDurationMs: number,
    onComplete?: () => void
  ) => {
    clearSimulationInterval(); // Clear any previous interval for this ref
    let currentStep = 0;
    const totalSteps = Math.max(1, estimatedDurationMs / PROGRESS_INTERVAL_MS);

    updateUIStage(stageName, {progress: 0.01, isActive: true}); // Activate and give small bump

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
      updateUIStage(stageName, {progress: simulatedProgress});

      if (currentStep >= totalSteps) {
        clearSimulationInterval();
        if (onComplete) onComplete();
      }
    }, PROGRESS_INTERVAL_MS);
  };

  const resetToStart = useCallback(() => {
    clearSimulationInterval();
    setSelectedFile(null);
    setSubmittedLink(null);
    setCurrentOverallStatus("");
    setProcessingUIStages([]);
    setErrorMessage(null);
    setTranscriptionData(null);
    setCurrentStepperStepId(APP_STEPS[0].id);
    setCurrentView(ViewState.SelectingInput);
  }, []);

  // Helper to update a specific stage in processingUIStages
  const updateUIStage = (
    stageName: string,
    values: Partial<Omit<StageDisplayData, "name">>
  ) => {
    setProcessingUIStages((prev) =>
      prev.map((s) => (s.name === stageName ? {...s, ...values} : s))
    );
  };

  // --- CLIENT-SIDE PROCESSING ---
  const handleClientSideProcessing = async (
    fileToProcess: File,
    mode: TranscriptionMode
  ) => {
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

    setCurrentStepperStepId(APP_STEPS[2].id);
    setCurrentView(ViewState.ProcessingClient);
    setCurrentOverallStatus("Processing your video...");
    setProcessingUIStages([
      {
        name: "ClientAudioExtraction",
        label: "Processing audio",
        progress: 0,
        isActive: true,
        isComplete: false,
        isIndeterminate: false,
        subText: "Preparing to extract...",
      },
      {
        name: "ClientTranscription",
        label: "Generating transcript",
        progress: 0,
        isActive: false,
        isComplete: false,
        isIndeterminate: true,
        subText: "Waiting for audio...",
      },
    ]);

    try {
      updateUIStage("ClientAudioExtraction", {
        isActive: true,
        isIndeterminate: false,
        label: "Extracting audio from video",
        subText: "Using in-browser technology...",
      });
      // Stage 1: Client Audio Extraction (Real Progress)
      await new Promise<Blob>(async (resolveExtract, rejectExtract) => {
        try {
          updateUIStage("ClientAudioExtraction", {
            progress: 0.01,
            isActive: true,
            label: "Extracting audio... 1%",
          });
          const audioBlob = await extractAudio({
            file: fileToProcess,
            outputFormat: "opus",
            onLog: (logMsg) => console.log("[FFMPEG_CLIENT_LOG]", logMsg),
            onProgress: (progVal) => {
              updateUIStage("ClientAudioExtraction", {progress: progVal}); // Label will be static, percentage shown next to it by ProcessingView
            },
          });

          updateUIStage("ClientAudioExtraction", {
            progress: 1,
            isActive: false,
            isComplete: true,
            label: "Audio Extracted!",
            subText: "✓ Done",
          });

          resolveExtract(audioBlob); // Pass audioBlob to the next .then()
        } catch (extractError) {
          rejectExtract(extractError);
        }
      })
        .then(async (audioBlob) => {
          // audioBlob received from successful extraction
          const audioSizeMB = audioBlob.size / (1024 * 1024);
          if (audioBlob.size > GROQ_AUDIO_LIMIT_BYTES) {
            throw new Error(
              `Extracted audio (${audioSizeMB.toFixed(
                2
              )} MB) exceeds transcription service limit of ${(
                GROQ_AUDIO_LIMIT_BYTES /
                (1024 * 1024)
              ).toFixed(0)} MB.`
            );
          }
          // Stage 2: Client Transcription
          updateUIStage("ClientTranscription", {
            isActive: true,
            isIndeterminate: true,
            label: "AI Transcribing",
            subText: "Sending to Groq's Whisper model...",
          });

          setCurrentOverallStatus("AI is transcribing your audio...");
          updateUIStage("ClientTranscription", {
            isActive: true,
            isIndeterminate: true,
            label: "AI Transcribing...",
            progress: 0.01,
          });

          runSimulatedUIStageProgress(
            "ClientTranscription",
            SIMULATED_CLIENT_TRANSCRIPTION_DURATION_MS
          );

          const formData = new FormData();
          formData.append(
            "audioBlob",
            audioBlob,
            `audio.${audioBlob.type.split("/")[1] || "opus"}`
          );
          return transcribeAudioAction(formData, mode); // Return the promise
        })
        .then((response) => {
          // response from transcribeAudioAction
          clearSimulationInterval();
          updateUIStage("ClientTranscription", {
            progress: 1,
            isActive: false,
            isComplete: true,
            isIndeterminate: false,
            label: "Transcription Complete!",
            subText: "✓ Done",
          });
          if (response.success && response.data) {
            setTranscriptionData(response.data);
            setCurrentOverallStatus("Transcription complete!");
            setCurrentView(ViewState.ShowingResults);
          } else {
            throw new Error(
              response.error || "Client-side transcription pipeline failed."
            );
          }
        });
    } catch (error) {
      clearSimulationInterval();
      const originalErrorMessage =
        error instanceof Error ? error.message : String(error);
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

  // --- SERVER-SIDE PROCESSING (COMMON HANDLER REFACTORED) ---
  const runServerProcess = async (
    actionCall: () => Promise<{
      success: boolean;
      data?: DetailedTranscriptionResult;
      error?: string;
    }>,
    initialStages: StageDisplayData[],
    initialOverallStatus: string,
    estimatedTotalDuration: number, // This duration is now for the *entire* server action
    errorContext: string,
    fileContext?: File
  ) => {
    setCurrentStepperStepId(APP_STEPS[2].id);
    setCurrentView(ViewState.ProcessingServer);
    // Set initial UI stages: first one active, others inactive. All indeterminate.
    setProcessingUIStages(
      initialStages.map((s, idx) => ({
        ...s,
        progress: 0, // Start all at 0 progress
        isActive: idx === 0,
        isComplete: false,
        isIndeterminate: true, // All server sub-steps are indeterminate from client POV
      }))
    );
    setCurrentOverallStatus(initialStages[0]?.label || initialOverallStatus); // Use first stage label

    // Clear previous conceptual message timers
    clearTimeout(conceptualMessageTimeout1Ref.current!);
    clearTimeout(conceptualMessageTimeout2Ref.current!);

    // Set up conceptual stage transitions using setTimeouts
    // These will mark previous stages complete and activate the next.
    // The "progress" of these indeterminate bars will be handled by their CSS (full width, pulsing).
    if (initialStages.length > 1) {
      conceptualMessageTimeout1Ref.current = setTimeout(() => {
        console.log(
          `[runServerProcess] Conceptual switch to stage 2: ${initialStages[1]?.label}`
        );
        updateUIStage(initialStages[0].name, {
          isActive: false,
          isComplete: true,
          progress: 1,
          subText: "✓ Done",
        }); // Mark stage 1 complete
        updateUIStage(initialStages[1].name, {
          isActive: true,
          subText: initialStages[1].subText || "Working...",
        }); // Activate stage 2
        setCurrentOverallStatus(initialStages[1].label);
      }, estimatedTotalDuration * 0.33); // Adjust timing: e.g., 33% of total est. time
    }
    if (initialStages.length > 2) {
      conceptualMessageTimeout2Ref.current = setTimeout(() => {
        console.log(
          `[runServerProcess] Conceptual switch to stage 3: ${initialStages[2]?.label}`
        );
        updateUIStage(initialStages[1].name, {
          isActive: false,
          isComplete: true,
          progress: 1,
          subText: "✓ Done",
        }); // Mark stage 2 complete
        updateUIStage(initialStages[2].name, {
          isActive: true,
          subText: initialStages[2].subText || "Transcribing...",
        }); // Activate stage 3
        setCurrentOverallStatus(initialStages[2].label);
      }, estimatedTotalDuration * 0.66); // Adjust timing: e.g., 66% of total est. time
    }

    try {
      const response = await actionCall(); // This is the single long wait for the server action
      clearAllTimers(); // Clear conceptual message timeouts and any stray simulation interval

      if (response.success && response.data) {
        setTranscriptionData(response.data);
        // Mark all defined UI stages as complete
        setProcessingUIStages((prev) =>
          prev.map((s) => ({
            ...s,
            progress: 1,
            isActive: false,
            isComplete: true,
            isIndeterminate: false,
            subText: "✓ Done",
          }))
        );
        setCurrentOverallStatus("Transcription complete!");
        setCurrentView(ViewState.ShowingResults);
      } else {
        throw new Error(response.error || `${errorContext} failed.`);
      }
    } catch (error) {
      /* ... same robust error handling as before, ensure clearAllTimers() is called ... */
      clearAllTimers();
      const originalErrorMessage =
        error instanceof Error ? error.message : String(error);
      const fileName = fileContext?.name;
      const fileSizeMB = fileContext
        ? (fileContext.size / (1024 * 1024)).toFixed(2)
        : undefined;
      setErrorMessage(
        getUserFriendlyErrorMessage(
          errorContext,
          originalErrorMessage,
          fileName,
          fileSizeMB
        )
      );
      setCurrentView(ViewState.Error);
    }
  };

  const handleServerSideLinkProcessing = (
    link: string,
    mode: TranscriptionMode
  ) => {
    runServerProcess(
      () => processVideoLinkAction(link, mode),
      [
        {
          name: "ServerLinkDownload",
          label: "Downloading Video",
          progress: 0,
          isActive: true,
          isComplete: false,
          isIndeterminate: true,
          subText: "Fetching from link...",
        },
        {
          name: "ServerLinkFFmpeg",
          label: "Processing Audio",
          progress: 0,
          isActive: false,
          isComplete: false,
          isIndeterminate: true,
          subText: "Extracting on server...",
        },
        {
          name: "ServerLinkTranscription",
          label: "Generating Transcript",
          progress: 0,
          isActive: false,
          isComplete: false,
          isIndeterminate: true,
          subText: "AI at work...",
        },
      ],
      "Server: Starting video link processing...",
      ESTIMATED_SERVER_LINK_ACTION_TOTAL_MS,
      "Server Link Processing"
    );
  };

  const handleServerSideFileUploadProcessing = (
    fileToProcess: File,
    mode: TranscriptionMode
  ) => {
    const formData = new FormData();
    formData.append("videoFile", fileToProcess);
    runServerProcess(
      () => processLargeVideoFileAction(formData, mode),
      [
        // Define the UI stages for ProcessingView
        {
          name: "ServerFileUpload",
          label: "Uploading File",
          progress: 0,
          isActive: true,
          isComplete: false,
          isIndeterminate: true,
          subText: "Sending to server...",
        },
        {
          name: "ServerFileFFmpeg",
          label: "Processing Audio",
          progress: 0,
          isActive: false,
          isComplete: false,
          isIndeterminate: true,
          subText: "Extracting on server...",
        },
        {
          name: "ServerFileTranscription",
          label: "Generating Transcript",
          progress: 0,
          isActive: false,
          isComplete: false,
          isIndeterminate: true,
          subText: "AI at work...",
        },
      ],
      "Server: Starting file processing...", // Initial overall status message
      ESTIMATED_SERVER_FILE_ACTION_TOTAL_MS,
      "Server File Upload",
      fileToProcess
    );
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setSubmittedLink(null);
    setCurrentStepperStepId(APP_STEPS[1].id); // To Settings/Confirmation
    setCurrentView(ViewState.ConfirmingInput);
  };
  const handleLinkSubmitted = (link: string) => {
    setSubmittedLink(link);
    setSelectedFile(null);
    setCurrentStepperStepId(APP_STEPS[1].id); // To Settings/Confirmation
    setCurrentView(ViewState.ConfirmingInput);
  };

  const handleConfirmation = (
    processingPath: "client" | "server",
    mode: TranscriptionMode
  ) => {
    setCurrentStepperStepId(APP_STEPS[2].id); // To Transcribe step for processing
    if (!ffmpeg && processingPath === "client" && selectedFile) {
      setErrorMessage(
        getUserFriendlyErrorMessage(
          "Confirmation",
          "FFmpeg is not ready. Please wait or refresh."
        )
      );
      setCurrentView(ViewState.Error);
      return;
    }
    if (processingPath === "client") {
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
    } else if (processingPath === "server") {
      if (selectedFile) {
        handleServerSideFileUploadProcessing(selectedFile, mode);
      } else if (submittedLink) {
        handleServerSideLinkProcessing(submittedLink, mode);
      } else {
        setErrorMessage(
          getUserFriendlyErrorMessage(
            "Confirmation",
            "No input provided for server processing."
          )
        );
        setCurrentView(ViewState.Error);
      }
    }
  };

  const handleCancelConfirmation = () => {
    setCurrentStepperStepId(APP_STEPS[0].id); // Back to Upload
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
            currentStepIdForStepper={currentStepperStepId}
          />
        );
      case ViewState.ProcessingClient:
      case ViewState.ProcessingServer:
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
