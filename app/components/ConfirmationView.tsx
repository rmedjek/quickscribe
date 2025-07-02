// app/components/ConfirmationView.tsx
"use client";

import React, {useState} from "react";
import {useSession} from "next-auth/react";
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
import clsx from "clsx";

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
  onConfirm,
  onCancel,
  isSubmitting = false,
}) => {
  const {status: authStatus} = useSession();
  const isAuthenticated = authStatus === "authenticated";
  const isAuthLoading = authStatus === "loading";

  const [selectedMode, setSelectedMode] = useState<TranscriptionMode>("core");

  const isFileProvided = !!file;
  const isLinkProvided = !!link && !file;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getInputTypeDisplayName = () => {
    if (isLinkProvided) return "Video Link";
    if (isFileProvided) return "Audio File";
    return "Input";
  };

  const getInputIcon = () => {
    if (isLinkProvided)
      return (
        <Video
          size={16}
          className="inline mr-1.5 text-[var(--text-secondary)]"
        />
      );
    if (isFileProvided)
      return (
        <Music
          size={16}
          className="inline mr-1.5 text-[var(--text-secondary)]"
        />
      );
    return (
      <FileText
        size={16}
        className="inline mr-1.5 text-[var(--text-secondary)]"
      />
    );
  };

  return (
    <div className="bg-[var(--card-bg)]  border-[var(--border-color)] p-6 sm:p-8 rounded-xl shadow-xl w-full max-w-xl mx-auto text-[var(--text-primary)]">
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold">QuickScribe</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Powered by Groq
        </p>
      </div>

      <ProgressStepper steps={APP_STEPS} currentStepId="configure" />

      <div className="my-6 p-4 bg-[var(--card-secondary-bg)] rounded-lg">
        <h3 className="text-base font-semibold mb-2 flex items-center">
          {getInputIcon()} Selected {getInputTypeDisplayName()}:
        </h3>
        {isFileProvided && file && (
          <div className="text-sm space-y-1 text-[var(--text-secondary)]">
            <p className="truncate">
              <strong>Name:</strong> {file.name}
            </p>
            <p>
              <strong>Type:</strong> {file.type}
            </p>
            <p>
              <strong>Size:</strong> {formatFileSize(file.size)}
            </p>
          </div>
        )}
        {isLinkProvided && (
          <p className="text-sm break-all text-[var(--text-secondary)]">
            <strong>URL:</strong> {link}
          </p>
        )}
      </div>

      {(isFileProvided || isLinkProvided) && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 text-center">
            Transcription Modes
          </h3>

          {/* --- THIS IS THE FIX --- */}
          {/* The Core/Turbo switch is restored here, above the mode cards. */}
          <div className="mb-6 flex items-center justify-center space-x-2">
            <span
              className={clsx(
                "px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all",
                selectedMode === "core"
                  ? "bg-sky-500 text-white shadow-md"
                  : "text-[var(--text-secondary)] hover:bg-slate-500/10"
              )}
              onClick={() => setSelectedMode("core")}
            >
              Core
            </span>
            <div
              className={clsx(
                "w-14 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors ease-in-out duration-300",
                selectedMode === "turbo" ? "bg-orange-500" : "bg-sky-500"
              )}
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
              />
            </div>
            <span
              className={clsx(
                "px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all",
                selectedMode === "turbo"
                  ? "bg-orange-500 text-white shadow-md"
                  : "text-[var(--text-secondary)] hover:bg-slate-500/10"
              )}
              onClick={() => setSelectedMode("turbo")}
            >
              Turbo
            </span>
          </div>
          {/* --- END FIX --- */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              className={clsx(
                "p-4 rounded-lg border-1 cursor-pointer transition-all",
                selectedMode === "core"
                  ? "border-sky-500 bg-sky-500/10 shadow-lg scale-105"
                  : "bg-[var(--card-secondary-bg)] border-transparent hover:border-slate-300 dark:hover:border-slate-600"
              )}
              onClick={() => setSelectedMode("core")}
              role="radio"
              aria-checked={selectedMode === "core"}
              tabIndex={0}
            >
              <div className="flex items-center mb-1">
                <Shield
                  size={20}
                  className={clsx(
                    "mr-2",
                    selectedMode === "core"
                      ? "text-sky-500"
                      : "text-[var(--text-secondary)]"
                  )}
                />
                <h4 className="font-semibold">Core Mode</h4>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Efficient & fast. Good for most use cases.
              </p>
            </div>

            <div
              className={clsx(
                "p-4 rounded-lg border-2 cursor-pointer transition-all",
                selectedMode === "turbo"
                  ? "border-orange-500 bg-orange-500/10 shadow-lg scale-105"
                  : "bg-[var(--card-secondary-bg)] border-transparent hover:border-slate-300 dark:hover:border-slate-600"
              )}
              onClick={() => setSelectedMode("turbo")}
              role="radio"
              aria-checked={selectedMode === "turbo"}
              tabIndex={0}
            >
              <div className="flex items-center mb-1">
                <Zap
                  size={20}
                  className={clsx(
                    "mr-2",
                    selectedMode === "turbo"
                      ? "text-orange-500"
                      : "text-[var(--text-secondary)]"
                  )}
                />
                <h4 className="font-semibold">Turbo Mode</h4>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Highest accuracy. Best for critical quality.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {isAuthLoading ? (
          <StyledButton size="lg" className="w-full" disabled>
            <Loader2 size={20} className="animate-spin mr-2" />
            Authenticating...
          </StyledButton>
        ) : !isAuthenticated ? (
          <StyledButton
            variant="secondary"
            size="lg"
            className="w-full"
            disabled
          >
            <LogIn size={20} className="mr-2" />
            Please Sign In to Continue
          </StyledButton>
        ) : (
          <StyledButton
            onClick={() => onConfirm("server", selectedMode)}
            variant="primary"
            size="lg"
            className="w-full "
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={20} className="animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              "Create Transcription Job"
            )}
          </StyledButton>
        )}
      </div>

      <StyledButton
        onClick={onCancel}
        variant="ghost"
        className="w-full mt-4 text-[var(--text-secondary)]"
        disabled={isSubmitting}
      >
        Back / Change Input
      </StyledButton>
    </div>
  );
};

export default ConfirmationView;
