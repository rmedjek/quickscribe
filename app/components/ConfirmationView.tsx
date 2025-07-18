// app/components/ConfirmationView.tsx
"use client";

import React from "react";
import {useSession} from "next-auth/react";
import {FileText, Music, Video, Loader2, LogIn} from "lucide-react";
import {APP_STEPS} from "@/types/app";
import StyledButton from "./StyledButton";
import ProgressStepper from "./ProgressStepper";
import {SelectedInputType} from "@/types/app";

export type TranscriptionMode = "core" | "turbo";

interface ConfirmationViewProps {
  file: File | null;
  link: string | null;
  inputType: SelectedInputType | null;
  onConfirm: () => void;
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
          Powered by AssemblyAI
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
            onClick={onConfirm}
            variant="primary"
            size="lg"
            className="w-full"
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
