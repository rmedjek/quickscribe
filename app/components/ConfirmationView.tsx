// app/components/ConfirmationView.tsx
"use client";

import React, {useState} from "react"; // Removed useEffect as it wasn't used
import {
  FileText,
  AlertTriangle,
  Server,
  CloudCog,
  Zap,
  Snowflake,
  Settings,
  Waves,
  Music, // Icon for Audio
  Video, // Icon for Video
} from "lucide-react";
import StyledButton from "./StyledButton";
import ProgressStepper, {Step as AppProgressStep} from "./ProgressStepper"; // Use existing Step type
import {SelectedInputType} from "@/types/app";

const MAX_CLIENT_SIZE_BYTES = 200 * 1024 * 1024; // 200MB example
export type TranscriptionMode = "chill" | "turbo";

interface ConfirmationViewProps {
  file: File | null;
  link: string | null;
  inputType: SelectedInputType | null; // NEW PROP to distinguish audio/video/link
  onConfirm: (
    processingPath: "client" | "server",
    mode: TranscriptionMode
  ) => void;
  onCancel: () => void;
}

// Define Stepper steps (can also be passed as props if they vary)
const APP_STEPS: AppProgressStep[] = [
  // Renamed Step to AppProgressStep to avoid conflict if needed
  {id: "configure", name: "Configure", icon: Settings},
  {id: "process", name: "Process Audio", icon: Waves},
  {id: "transcribe", name: "Get Transcripts", icon: FileText},
];

const ConfirmationView: React.FC<ConfirmationViewProps> = ({
  file,
  link,
  inputType, // Destructure and use the new prop
  onConfirm,
  onCancel,
}) => {
  const isFileProvided = !!file;
  const isLinkProvided = !!link && !file; // This logic is fine
  const isLargeFile = isFileProvided && file.size > MAX_CLIENT_SIZE_BYTES;

  const [selectedMode, setSelectedMode] = useState<TranscriptionMode>("chill");

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getInputTypeDisplayName = () => {
    if (isLinkProvided) return "Video Link";
    if (isFileProvided) {
      if (inputType === "audio") return "Audio File";
      if (inputType === "video") return "Video File";
      return "File"; // Fallback
    }
    return "Input";
  };

  const getInputIcon = () => {
    if (isLinkProvided)
      return <Video size={16} className="inline mr-1.5 text-slate-500" />;
    if (isFileProvided) {
      if (inputType === "audio")
        return <Music size={16} className="inline mr-1.5 text-slate-500" />;
      if (inputType === "video")
        return <Video size={16} className="inline mr-1.5 text-slate-500" />;
    }
    return <FileText size={16} className="inline mr-1.5 text-slate-500" />;
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-xl shadow-xl w-full max-w-lg md:max-w-xl mx-auto text-slate-700 dark:text-slate-200">
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          QuickScribe
        </h1>
        <p className="text-sm text-slate-500 mt-1">Powered by Groq</p>
      </div>

      <ProgressStepper steps={APP_STEPS} currentStepId="configure" />

      <div className="mb-6 p-4 border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm">
        <h3 className="text-base font-semibold mb-2 text-slate-700 dark:text-slate-200 flex items-center">
          {getInputIcon()} Selected {getInputTypeDisplayName()}:
        </h3>
        {isFileProvided && file && (
          <>
            <p className="truncate ml-1">
              <strong>Name:</strong> {file.name}
            </p>
            <p className="ml-1">
              <strong>Type:</strong> {file.type}
            </p>
            <p className="ml-1">
              <strong>Size:</strong> {formatFileSize(file.size)}
            </p>
          </>
        )}
        {isLinkProvided && (
          <p className="break-all ml-1">
            <strong>URL:</strong> {link}
          </p>
        )}
      </div>

      {/* Chill/Turbo Toggle & Mode Cards (only if file or link is provided) */}
      {(isFileProvided || isLinkProvided) && (
        <>
          {/* ... (Chill/Turbo toggle and Mode Cards remain the same) ... */}
          <div className="mb-6 flex items-center justify-center space-x-2">
            <span
              className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                selectedMode === "chill"
                  ? "bg-sky-500 text-white shadow-md"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
              onClick={() => setSelectedMode("chill")}
            >
              Chill
            </span>
            <div
              className={`w-14 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors ease-in-out duration-300 ${
                selectedMode === "turbo" ? "bg-orange-500" : "bg-sky-500"
              }`}
              onClick={() =>
                setSelectedMode(selectedMode === "chill" ? "turbo" : "chill")
              }
            >
              <div
                className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${
                  selectedMode === "turbo" ? "translate-x-7" : ""
                }`}
              ></div>
            </div>
            <span
              className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                selectedMode === "turbo"
                  ? "bg-orange-500 text-white shadow-md"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
              onClick={() => setSelectedMode("turbo")}
            >
              Turbo
            </span>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-800 mb-3 text-center">
              Transcription Modes
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedMode === "chill"
                    ? "border-sky-500 bg-sky-50 shadow-lg scale-105"
                    : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:border-slate-300"
                }`}
                onClick={() => setSelectedMode("chill")}
              >
                <div className="flex items-center mb-1">
                  <Snowflake
                    size={20}
                    className={`mr-2 ${
                      selectedMode === "chill"
                        ? "text-sky-600"
                        : "text-slate-500"
                    }`}
                  />
                  <h4 className="font-semibold text-slate-700 dark:text-slate-200">
                    Chill Mode
                  </h4>
                </div>
                <p className="text-xs text-slate-500">
                  Efficient & fast with Distil-Whisper. Good for most cases.
                </p>
              </div>
              <div
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedMode === "turbo"
                    ? "border-orange-500 bg-orange-50 shadow-lg scale-105"
                    : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:border-slate-300"
                }`}
                onClick={() => setSelectedMode("turbo")}
              >
                <div className="flex items-center mb-1">
                  <Zap
                    size={20}
                    className={`mr-2 ${
                      selectedMode === "turbo"
                        ? "text-orange-600"
                        : "text-slate-500"
                    }`}
                  />
                  <h4 className="font-semibold text-slate-700 dark:text-slate-200">
                    Turbo Mode
                  </h4>
                </div>
                <p className="text-xs text-slate-500">
                  Highest accuracy with Whisper Large v3. Best for critical
                  quality.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- Action Buttons --- */}
      {/* Case 1: Link is provided (always server processing) */}
      {isLinkProvided && (
        <StyledButton
          onClick={() => onConfirm("server", selectedMode)}
          variant="primary"
          size="lg"
          className="w-full bg-orange-500 hover:bg-orange-600 focus-visible:ring-orange-400"
        >
          Generate Transcripts from Link
        </StyledButton>
      )}

      {/* Case 2: File is provided */}
      {isFileProvided && (
        <>
          {isLargeFile && (
            <div className="mb-4 p-3 border border-amber-300 rounded-lg bg-amber-50 text-amber-600 text-xs flex items-center">
              <AlertTriangle
                size={18}
                className="text-amber-500 mr-2 flex-shrink-0"
              />
              <span>
                Large file ({file ? formatFileSize(file.size) : "N/A"}). Server
                processing is recommended.
              </span>
            </div>
          )}

          <div className="space-y-3">
            {/* Server Processing Button */}
            <StyledButton
              onClick={() => onConfirm("server", selectedMode)}
              // For large files OR audio files, server is often preferred/safer.
              // Make server primary if large, or if it's audio (unless small audio where client is also fine).
              variant={
                isLargeFile || inputType === "audio" ? "primary" : "secondary"
              }
              size="lg"
              className={`w-full group ${
                isLargeFile || inputType === "audio"
                  ? "bg-orange-500 hover:bg-orange-600 focus-visible:ring-orange-400"
                  : ""
              }`}
            >
              <Server size={20} className="mr-2" />
              Process on Server
              {isLargeFile && " (Recommended)"}
              {inputType === "audio" && !isLargeFile && " (Audio File)"}
            </StyledButton>

            {/* Client Processing Button - show unless it's a large audio file where server is heavily pushed */}
            {!(isLargeFile && inputType === "audio") && (
              <StyledButton
                onClick={() => onConfirm("client", selectedMode)}
                variant={
                  !isLargeFile && inputType !== "audio"
                    ? "primary"
                    : "secondary"
                } // Primary if small video. Secondary otherwise.
                size="lg"
                className="w-full group"
              >
                <CloudCog size={20} className="mr-2" />
                Process in Browser
                {isLargeFile &&
                  inputType === "video" &&
                  " (May be Slow for Large Video)"}
                {!isLargeFile && inputType === "audio" && " (Audio File)"}
              </StyledButton>
            )}
          </div>

          {isLargeFile && (
            <p className="text-xs mt-3 text-slate-500 text-center">
              Server processing is faster and more reliable for large files.
              Your file is uploaded securely and deleted after processing.
            </p>
          )}
          {!isLargeFile && inputType === "audio" && (
            <p className="text-xs mt-3 text-slate-500 text-center">
              For audio files, browser processing sends the file directly for
              transcription (may convert to Opus if needed).
            </p>
          )}
        </>
      )}

      <div className="text-center mt-6">
        {/* <p className="text-xs text-slate-400">Version X.Y.Z</p> */}
      </div>
      <StyledButton
        onClick={onCancel}
        variant="ghost"
        className="w-full mt-4 text-slate-600" // Added mt-4
      >
        Back / Change Input
      </StyledButton>
    </div>
  );
};

export default ConfirmationView;
