// app/components/ConfirmationView.tsx
"use client";

import React, {useState} from "react";
import {useSession} from "next-auth/react"; // Import the useSession hook
import {
  FileText,
  Zap,
  Shield,
  Music,
  Video,
  Loader2,
  LogIn,
} from "lucide-react";
import {APP_STEPS} from "@/types/app";
import StyledButton from "./StyledButton";
import ProgressStepper from "./ProgressStepper";
import {SelectedInputType} from "@/types/app";

export type TranscriptionMode = "core" | "turbo";

interface ConfirmationViewProps {
  file: File | null;
  link: string | null;
  inputType: SelectedInputType | null;
  onConfirm: (
    processingPath: "client" | "server",
    mode: TranscriptionMode
  ) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const ConfirmationView: React.FC<ConfirmationViewProps> = ({
  file,
  link,
  inputType,
  onConfirm,
  onCancel,
  isSubmitting = false,
}) => {
  // --- AUTH AWARENESS ---
  // We now check the authentication status on the client.
  const {status: authStatus} = useSession();
  const isAuthenticated = authStatus === "authenticated";
  const isAuthLoading = authStatus === "loading";

  const isFileProvided = !!file;
  const isLinkProvided = !!link && !file;
  const [selectedMode, setSelectedMode] = useState<TranscriptionMode>("core");

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

  // --- RENDER LOGIC FOR THE ACTION BUTTON ---
  const renderConfirmButton = () => {
    if (isAuthLoading) {
      return (
        <StyledButton size="lg" className="w-full" disabled>
          <Loader2 size={20} className="animate-spin mr-2" />
          Authenticating...
        </StyledButton>
      );
    }

    if (!isAuthenticated) {
      return (
        <StyledButton
          variant="secondary"
          size="lg"
          className="w-full"
          // We can't actually sign in from here, so we just show the message.
          // The user should use the main "Sign In" button in the header.
          disabled
        >
          <LogIn size={20} className="mr-2" />
          Please Sign In to Continue
        </StyledButton>
      );
    }

    // If authenticated, show the normal button
    const buttonText = isLinkProvided
      ? "Process Link & Transcribe"
      : "Upload & Transcribe";

    return (
      <StyledButton
        onClick={() => onConfirm("server", selectedMode)}
        variant="primary"
        size="lg"
        className="w-full bg-orange-500 hover:bg-orange-600 focus-visible:ring-orange-400"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={20} className="animate-spin mr-2" />
            Submitting...
          </>
        ) : (
          buttonText
        )}
      </StyledButton>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-xl shadow-xl w-full max-w-lg md:max-w-xl mx-auto text-slate-700 dark:text-slate-200">
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50">
          QuickScribe
        </h1>
        <p className="text-sm text-slate-500 mt-1">Powered by Groq</p>
      </div>

      <ProgressStepper steps={APP_STEPS} currentStepId="configure" />

      <div className="my-6 p-4 border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm rounded-lg">
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

      {(isFileProvided || isLinkProvided) && (
        <>
          <div className="mb-6 flex items-center justify-center space-x-2">
            <span
              className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                selectedMode === "core"
                  ? "bg-sky-500 text-white shadow-md"
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
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
                setSelectedMode(selectedMode === "core" ? "turbo" : "core")
              }
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
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
              onClick={() => setSelectedMode("turbo")}
            >
              Turbo
            </span>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3 text-center">
              Transcription Modes
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedMode === "core"
                    ? "border-sky-500 bg-sky-50 dark:bg-sky-900/40 shadow-lg scale-105"
                    : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 hover:border-slate-300 dark:hover:border-slate-500"
                }`}
                onClick={() => setSelectedMode("core")}
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
                  Efficient & fast. Good for most use cases.
                </p>
              </div>
              <div
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedMode === "turbo"
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-900/30 shadow-lg scale-105"
                    : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 hover:border-slate-300 dark:hover:border-slate-500"
                }`}
                onClick={() => setSelectedMode("turbo")}
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
                  Highest accuracy. Best for critical quality.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="space-y-3">
        <StyledButton
          onClick={() => onConfirm("server", selectedMode)}
          variant="primary"
          size="lg"
          className="w-full bg-orange-500 hover:bg-orange-600 focus-visible:ring-orange-400"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={20} className="animate-spin mr-2" />
              Submitting...
            </>
          ) : isLinkProvided ? (
            "Process Link & Transcribe"
          ) : (
            "Upload & Transcribe"
          )}
        </StyledButton>
      </div>

      <StyledButton
        onClick={onCancel}
        variant="ghost"
        className="w-full mt-4 text-slate-600 dark:text-slate-300"
        disabled={isSubmitting}
      >
        Back / Change Input
      </StyledButton>
    </div>
  );
};

export default ConfirmationView;
