// app/page.tsx
"use client";

import React, {useState, useCallback} from "react";
import {useRouter} from "next/navigation";
import {upload} from "@vercel/blob/client";

// CORRECTED: Import both server actions
import {
  startTranscriptionJob,
  startLinkTranscriptionJob,
} from "@/app/actions/jobActions";
import {calculateFileHash} from "@/app/lib/hash-utils";

import {type SelectedInputType} from "@/types/app";
import PageLayout from "@/components/PageLayout";
import InputSelectionView from "@/components/InputSelectionView";
import ConfirmationView, {
  TranscriptionMode,
} from "@/components/ConfirmationView";
import StyledButton from "@/components/StyledButton";
import {StepperProvider, useStepper} from "./contexts/StepperContext";

enum ViewState {
  SelectingInput,
  ConfirmingInput,
  Submitting,
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
      lowerError.includes("payload too large"))
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

function HomePageInner() {
  const {setStep} = useStepper();
  const router = useRouter();

  const [currentView, setCurrentView] = useState<ViewState>(
    ViewState.SelectingInput
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submittedLink, setSubmittedLink] = useState<string | null>(null);
  const [selectedInputType, setSelectedInputType] =
    useState<SelectedInputType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submissionStatus, setSubmissionStatus] = useState("");

  const handleError = useCallback((ctx: string, msg: string) => {
    const friendlyMsg = getUserFriendlyErrorMessage(ctx, msg);
    setErrorMessage(friendlyMsg);
    setCurrentView(ViewState.Error);
    setIsSubmitting(false);
  }, []);

  const resetToStart = useCallback(() => {
    setSelectedFile(null);
    setSubmittedLink(null);
    setErrorMessage(null);
    setCurrentView(ViewState.SelectingInput);
    setStep("configure");
    setIsSubmitting(false);
    setUploadProgress(0);
    setSubmissionStatus("");
  }, [setStep]);

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setSubmittedLink(null);
    if (file.type.startsWith("audio/") || file.type.startsWith("video/")) {
      setSelectedInputType(file.type.startsWith("audio/") ? "audio" : "video");
      setCurrentView(ViewState.ConfirmingInput);
    } else {
      handleError(
        "File Type Error",
        `Unsupported file type: ${file.type}. Please select a valid video or audio file.`
      );
    }
  };

  const handleLinkSubmitted = (link: string) => {
    setSubmittedLink(link);
    setSelectedFile(null);
    setSelectedInputType("link");
    setCurrentView(ViewState.ConfirmingInput);
  };

  const handleConfirmation = async (
    processingPath: "client" | "server",
    mode: TranscriptionMode
  ) => {
    setIsSubmitting(true);
    setCurrentView(ViewState.Submitting);
    setStep("process");

    try {
      let result: {success: boolean; jobId?: string; error?: string};

      if (selectedFile) {
        setSubmissionStatus("Analyzing file...");
        const fileHash = await calculateFileHash(selectedFile);

        setSubmissionStatus("Uploading file...");
        const newBlob = await upload(selectedFile.name, selectedFile, {
          access: "public",
          handleUploadUrl: "/api/client-upload",
          onUploadProgress: (progress) =>
            setUploadProgress(progress.percentage),
        });

        setSubmissionStatus("Creating transcription job...");
        result = await startTranscriptionJob({
          blobUrl: newBlob.url,
          originalFileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileHash: fileHash,
          transcriptionMode: mode,
        });
      } else if (submittedLink) {
        setSubmissionStatus("Creating transcription job...");
        result = await startLinkTranscriptionJob({
          linkUrl: submittedLink,
          transcriptionMode: mode,
        });
      } else {
        throw new Error("No file or link was provided.");
      }

      if (result.success && result.jobId) {
        router.push(`/dashboard/job/${result.jobId}`);
      } else {
        throw new Error(result.error || "Server failed to create the job.");
      }
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : "An unknown error occurred during submission.";
      handleError("Job Submission", msg);
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
            inputType={selectedInputType}
            onConfirm={handleConfirmation}
            onCancel={resetToStart}
            isSubmitting={isSubmitting}
          />
        );
      case ViewState.Submitting:
        return (
          <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-xl w-full max-w-lg mx-auto text-center">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">
              {submissionStatus}
            </h2>
            {selectedFile && (
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-sky-600 h-4 rounded-full transition-all duration-300"
                  style={{width: `${uploadProgress}%`}}
                />
              </div>
            )}
            <p className="text-sm text-slate-500 mt-4">
              Your job is being submitted. You will be redirected shortly.
            </p>
          </div>
        );
      case ViewState.Error:
        return (
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl max-w-lg mx-auto text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-4">
              An Error Occurred
            </h2>
            <p className="text-slate-700 dark:text-slate-200 mb-6 break-words">
              {errorMessage}
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

  return renderCurrentView();
}

export default function HomePage() {
  return (
    <StepperProvider>
      <PageLayout>
        <HomePageInner />
      </PageLayout>
    </StepperProvider>
  );
}
