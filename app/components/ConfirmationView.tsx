// app/components/ConfirmationView.tsx
"use client";

import React, {useState} from "react";
import {
  FileText,
  AlertTriangle,
  Server,
  CloudCog,
  Zap,
  Shield,
  Music,
  Video,
  Brain,
  Users,
} from "lucide-react";
import {
  APP_STEPS,
  TranscriptionMode,
  TranscriptionEngine,
  SelectedInputType,
} from "@/types/app";
import StyledButton from "./StyledButton";
import ProgressStepper from "./ProgressStepper";

const MAX_CLIENT_SIZE_BYTES = 200 * 1024 * 1024;

interface ConfirmationViewProps {
  file: File | null;
  link: string | null;
  inputType: SelectedInputType | null;
  onConfirm: (
    processingPath: "client" | "server",
    mode: TranscriptionMode,
    engine: TranscriptionEngine
  ) => void;
  onCancel: () => void;
}

const ConfirmationView: React.FC<ConfirmationViewProps> = ({
  file,
  link,
  inputType,
  onConfirm,
  onCancel,
}) => {
  const isFileProvided = !!file;
  const isLinkProvided = !!link && !file;
  const isLargeFile = isFileProvided && file.size > MAX_CLIENT_SIZE_BYTES;

  const [selectedMode, setSelectedMode] = useState<TranscriptionMode>("core");
  const [selectedEngine, setSelectedEngine] =
    useState<TranscriptionEngine>("groq");

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
      return "File";
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
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50">
          QuickScribe
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Powered by Groq & AssemblyAI
        </p>
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

      {/* --- Transcription Engine Selection --- */}
      {(isFileProvided || isLinkProvided) && (
        <>
          <div className="mb-6 flex items-center justify-center space-x-2">
            <span
              className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                selectedEngine === "groq"
                  ? "bg-sky-500 text-white shadow-md"
                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
              onClick={() => setSelectedEngine("groq")}
            >
              Groq
            </span>
            <div
              className={`w-14 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors ease-in-out duration-300 ${
                selectedEngine === "assembly" ? "bg-orange-500" : "bg-sky-500"
              }`}
              onClick={() =>
                setSelectedEngine((prev) =>
                  prev === "groq" ? "assembly" : "groq"
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedEngine((prev) =>
                    prev === "groq" ? "assembly" : "groq"
                  );
                }
              }}
              role="switch"
              aria-checked={selectedEngine === "assembly"}
              tabIndex={0}
            >
              <div
                className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${
                  selectedEngine === "assembly" ? "translate-x-7" : ""
                }`}
              ></div>
            </div>
            <span
              className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                selectedEngine === "assembly"
                  ? "bg-orange-500 text-white shadow-md"
                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
              onClick={() => setSelectedEngine("assembly")}
            >
              Assembly
            </span>
          </div>
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3 text-center">
              Choose Transcription Engine
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedEngine === "groq"
                    ? "border-green-500 bg-green-50 dark:bg-green-900/30 dark:border-green-400 shadow-lg scale-105"
                    : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500"
                }`}
                onClick={() => setSelectedEngine("groq")}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    setSelectedEngine("groq");
                }}
                role="radio"
                aria-checked={selectedEngine === "groq"}
              >
                <div className="flex items-center mb-1">
                  <Brain
                    size={20}
                    className={`mr-2 ${
                      selectedEngine === "groq"
                        ? "text-green-600"
                        : "text-slate-500"
                    }`}
                  />
                  <h4 className="font-semibold text-slate-700 dark:text-slate-200">
                    Groq (Whisper)
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Fast, high-quality. Best for single speakers or when speaker
                  labels aren&apos;t needed.
                </p>
              </div>
              <div
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedEngine === "assembly"
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 dark:border-purple-400 shadow-lg scale-105"
                    : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500"
                }`}
                onClick={() => setSelectedEngine("assembly")}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    setSelectedEngine("assembly");
                }}
                role="radio"
                aria-checked={selectedEngine === "assembly"}
              >
                <div className="flex items-center mb-1">
                  <Users
                    size={20}
                    className={`mr-2 ${
                      selectedEngine === "assembly"
                        ? "text-purple-600"
                        : "text-slate-500"
                    }`}
                  />
                  <h4 className="font-semibold text-slate-700 dark:text-slate-200">
                    AssemblyAI
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Provides speaker labels (diarization). Ideal for
                  conversations.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- Core/Turbo Mode Selection (ONLY for Groq Engine) --- */}
      {(isFileProvided || isLinkProvided) && selectedEngine === "groq" && (
        <>
          <div className="mb-6 flex items-center justify-center space-x-2">
            <span
              className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                selectedMode === "core"
                  ? "bg-sky-500 text-white shadow-md"
                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
              onClick={() => setSelectedMode("core")}
            >
              Core
            </span>
            <div
              className={`w-14 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors ease-in-out duration-300 ${
                selectedMode === "turbo" ? "bg-orange-500" : "bg-sky-500"
              }`}
              onClick={() =>
                setSelectedMode((prev) => (prev === "core" ? "turbo" : "core"))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedMode((prev) =>
                    prev === "core" ? "turbo" : "core"
                  );
                }
              }}
              role="switch"
              aria-checked={selectedMode === "turbo"}
              tabIndex={0}
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
                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
              onClick={() => setSelectedMode("turbo")}
            >
              Turbo
            </span>
          </div>
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3 text-center">
              Transcription Quality
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedMode === "core"
                    ? "border-sky-500 bg-sky-50 dark:bg-sky-900/30 dark:border-sky-400 shadow-lg scale-105"
                    : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500"
                }`}
                onClick={() => setSelectedMode("core")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    setSelectedMode("core");
                }}
                role="radio"
                aria-checked={selectedMode === "core"}
                tabIndex={0}
              >
                <div className="flex items-center mb-1">
                  <Shield
                    size={20}
                    className={`mr-2 ${
                      selectedMode === "core"
                        ? "text-sky-600"
                        : "text-slate-500"
                    }`}
                  />
                  <h4 className="font-semibold text-slate-700 dark:text-slate-200">
                    Core Mode
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Reliable & fast with Whisper Large v3. Great for all
                  languages.
                </p>
              </div>
              <div
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedMode === "turbo"
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-400 shadow-lg scale-105"
                    : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500"
                }`}
                onClick={() => setSelectedMode("turbo")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    setSelectedMode("turbo");
                }}
                role="radio"
                aria-checked={selectedMode === "turbo"}
                tabIndex={0}
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
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Potentially faster, high-accuracy model (if configured).
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- Action Buttons --- */}
      <div className="mt-6 space-y-3">
        {" "}
        {/* Added mt-6 for spacing */}
        {/* Case 1: Link is provided */}
        {isLinkProvided && (
          <StyledButton
            onClick={() => onConfirm("server", selectedMode, selectedEngine)}
            variant="primary"
            size="lg"
            className="w-full bg-orange-500 hover:bg-orange-600 focus-visible:ring-orange-400"
          >
            Transcribe Link with{" "}
            {selectedEngine === "groq"
              ? `Groq (${selectedMode === "core" ? "Core" : "Turbo"})`
              : "AssemblyAI"}
          </StyledButton>
        )}
        {/* Case 2: File is provided */}
        {isFileProvided && (
          <>
            {/* --- AssemblyAI File Processing --- */}
            {selectedEngine === "assembly" && (
              <>
                {isLargeFile && (
                  <div className="mb-4 p-3 border border-amber-300 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-600 text-xs flex items-center">
                    <AlertTriangle
                      size={18}
                      className="text-amber-500 dark:text-amber-400 mr-2 flex-shrink-0"
                    />
                    <span>
                      Note: This is a large file (
                      {file ? formatFileSize(file.size) : "N/A"}).
                    </span>
                  </div>
                )}
                <StyledButton
                  onClick={() => onConfirm("server", "core", "assembly")} // Mode is 'core' by default for AssemblyAI
                  variant="primary"
                  size="lg"
                  className="w-full bg-purple-600 hover:bg-purple-700 focus-visible:ring-purple-400"
                >
                  <Users size={20} className="mr-2" />
                  Transcribe with Speaker Labels (AssemblyAI)
                </StyledButton>
                <p className="text-xs mt-2 text-slate-500 dark:text-slate-400 text-center">
                  AssemblyAI processing always occurs on the server. Your file
                  will be uploaded securely.
                </p>
              </>
            )}

            {/* --- Groq File Processing Buttons --- */}
            {selectedEngine === "groq" && (
              <>
                {isLargeFile && (
                  <div className="mb-4 p-3 border border-amber-300 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-600 text-xs flex items-center">
                    <AlertTriangle
                      size={18}
                      className="text-amber-500 dark:text-amber-400 mr-2 flex-shrink-0"
                    />
                    <span>
                      Large file ({file ? formatFileSize(file.size) : "N/A"}).
                      Server processing is recommended for Groq.
                    </span>
                  </div>
                )}
                <StyledButton
                  onClick={() => onConfirm("server", selectedMode, "groq")}
                  variant={
                    isLargeFile || inputType === "audio"
                      ? "primary"
                      : "secondary"
                  }
                  size="lg"
                  className={`w-full group ${
                    isLargeFile || inputType === "audio"
                      ? "bg-orange-500 hover:bg-orange-600 focus-visible:ring-orange-400"
                      : ""
                  }`}
                >
                  <Server size={20} className="mr-2" />
                  Process with Groq (Server)
                  {isLargeFile && " (Recommended)"}
                </StyledButton>

                {!(isLargeFile && inputType === "audio") && (
                  <StyledButton
                    onClick={() => onConfirm("client", selectedMode, "groq")}
                    variant={
                      !isLargeFile && inputType !== "audio"
                        ? "primary"
                        : "secondary"
                    }
                    size="lg"
                    className="w-full group"
                  >
                    <CloudCog size={20} className="mr-2" />
                    Process with Groq (Browser)
                    {isLargeFile && inputType === "video" && " (May be Slow)"}
                  </StyledButton>
                )}
                {isLargeFile && (
                  <p className="text-xs mt-2 text-slate-500 dark:text-slate-400 text-center">
                    Groq server processing is faster for large files.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="text-center mt-6"></div>
      <StyledButton
        onClick={onCancel}
        variant="ghost"
        className="w-full mt-4 text-slate-600 dark:text-slate-300"
      >
        Back / Change Input
      </StyledButton>
    </div>
  );
};

export default ConfirmationView;
