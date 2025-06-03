// app/components/ConfirmationView.tsx
"use client";

import React, {useState} from "react";
import {
  FileText,
  AlertTriangle,
  Server,
  CloudCog,
  Zap,
  Snowflake,
  Settings,
  Waves,
} from "lucide-react"; // Added more icons
import StyledButton from "./StyledButton";
import ProgressStepper from "./ProgressStepper";

const MAX_CLIENT_SIZE_BYTES = 200 * 1024 * 1024;
export type TranscriptionMode = "chill" | "turbo";

interface ConfirmationViewProps {
  file: File | null;
  link: string | null;
  onConfirm: (
    processingPath: "client" | "server",
    mode: TranscriptionMode
  ) => void;
  onCancel: () => void;
  currentStepIdForStepper?: string; // e.g., 'settings'
}

// Define Stepper steps (can also be passed as props if they vary)
const APP_STEPS = [
  {id: "configure", name: "Configure", icon: Settings},
  {id: "process", name: "Process Audio", icon: Waves},
  {id: "transcribe", name: "Get Transcripts", icon: FileText},
];

const ConfirmationView: React.FC<ConfirmationViewProps> = ({
  file,
  link,
  onConfirm,
  onCancel,
}) => {
  const isFileProvided = !!file;
  const isLinkProvided = !!link && !file;
  const isLargeFile = isFileProvided && file.size > MAX_CLIENT_SIZE_BYTES;

  const [selectedMode, setSelectedMode] = useState<TranscriptionMode>("chill"); // Default to chill

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl w-full max-w-lg md:max-w-xl mx-auto text-slate-700">
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          QuickScribe
        </h1>
        <p className="text-sm text-slate-500 mt-1">Powered by Groq</p>
      </div>

      <ProgressStepper steps={APP_STEPS} currentStepId="configure" />

      <div className="mb-6 p-4 border border-slate-200 rounded-lg bg-slate-50 text-sm">
        <h3 className="text-base font-semibold mb-2 text-slate-700">
          Selected Input:
        </h3>
        {isFileProvided && file && (
          <>
            <p className="truncate">
              <strong>File:</strong> {file.name}
            </p>
            <p>
              <strong>Size:</strong> {formatFileSize(file.size)}
            </p>
          </>
        )}
        {isLinkProvided && (
          <p className="break-all">
            <strong>Link:</strong> {link}
          </p>
        )}
      </div>

      {/* Chill/Turbo Toggle & Mode Cards (only if file or link is provided) */}
      {(isFileProvided || isLinkProvided) && (
        <>
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
                    : "border-slate-200 bg-slate-50 hover:border-slate-300"
                }`}
                onClick={() => setSelectedMode("chill")}
              >
                <div className="flex items-center mb-1">
                  {" "}
                  <Snowflake
                    size={20}
                    className={`mr-2 ${
                      selectedMode === "chill"
                        ? "text-sky-600"
                        : "text-slate-500"
                    }`}
                  />{" "}
                  <h4 className="font-semibold text-slate-700">Chill Mode</h4>{" "}
                </div>
                <p className="text-xs text-slate-500">
                  Efficient & fast with Distil-Whisper. Good for most cases.
                </p>
              </div>
              <div
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedMode === "turbo"
                    ? "border-orange-500 bg-orange-50 shadow-lg scale-105"
                    : "border-slate-200 bg-slate-50 hover:border-slate-300"
                }`}
                onClick={() => setSelectedMode("turbo")}
              >
                <div className="flex items-center mb-1">
                  {" "}
                  <Zap
                    size={20}
                    className={`mr-2 ${
                      selectedMode === "turbo"
                        ? "text-orange-600"
                        : "text-slate-500"
                    }`}
                  />{" "}
                  <h4 className="font-semibold text-slate-700">Turbo Mode</h4>{" "}
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

      {/* --- Action Buttons based on input type --- */}
      {/* Case 1: Link is provided */}
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

      {/* Case 2: File is provided AND it's NOT large */}
      {isFileProvided && !isLargeFile && (
        <StyledButton
          onClick={() => onConfirm("client", selectedMode)}
          variant="primary"
          size="lg"
          className="w-full bg-orange-500 hover:bg-orange-600 focus-visible:ring-orange-400"
        >
          Generate Transcripts (In Browser)
        </StyledButton>
      )}

      {/* Case 3: File is provided AND it IS large (offer choice and show warning) */}
      {isFileProvided && isLargeFile && (
        <>
          <div className="mb-4 p-3 border border-amber-300 rounded-lg bg-amber-50 text-amber-600 text-xs flex items-center">
            <AlertTriangle
              size={18}
              className="text-amber-500 mr-2 flex-shrink-0"
            />
            <span>
              Large file ({file ? formatFileSize(file.size) : "N/A"}). Choose a
              processing method:
            </span>
          </div>
          <div className="space-y-3">
            <StyledButton
              onClick={() => onConfirm("server", selectedMode)}
              variant="primary"
              size="lg"
              className="w-full bg-orange-500 hover:bg-orange-600 focus-visible:ring-orange-400 group"
            >
              <Server size={20} className="mr-2" />
              Process on Server (Recommended for Large Files)
            </StyledButton>
            <StyledButton
              onClick={() => onConfirm("client", selectedMode)}
              variant="secondary"
              size="lg"
              className="w-full group"
            >
              <CloudCog size={20} className="mr-2" />
              Process in Browser (May be Slow)
            </StyledButton>
          </div>
          <p className="text-xs mt-3 text-slate-500 text-center">
            Server processing is faster for large files. Your file is uploaded
            securely and deleted after processing.
          </p>
        </>
      )}

      <div className="text-center mt-6">
        <p className="text-xs text-slate-400">{/* Version X.Y.Z */}</p>
      </div>
      <StyledButton
        onClick={onCancel}
        variant="ghost"
        className="w-full mt-2 text-slate-600"
      >
        Back / Change Input
      </StyledButton>
    </div>
  );
};

export default ConfirmationView;
