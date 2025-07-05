// app/components/NewTranscriptionPage.tsx
"use client";

import React, {useState, useCallback} from "react";
import {useRouter} from "next/navigation";
import {upload} from "@vercel/blob/client";
import {
  startTranscriptionJob,
  startLinkTranscriptionJob,
} from "@/actions/jobActions";
import {calculateFileHash} from "@/lib/hash-utils";
import {
  type SelectedInputType,
  APP_STEPS,
  type StageDisplayData,
} from "@/types/app";
import InputSelectionView from "@/components/InputSelectionView";
import ConfirmationView, {
  TranscriptionMode,
} from "@/components/ConfirmationView";
import ProcessingView from "@/components/ProcessingView";
import {StepperProvider, useStepper} from "../contexts/StepperContext";

enum ViewState {
  SelectingInput,
  ConfirmingInput,
  Submitting,
  Error,
}

function NewTranscriptionContent() {
  const {setStep, step} = useStepper();
  const router = useRouter();
  const [view, setView] = useState<ViewState>(ViewState.SelectingInput);
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [inputType, setInputType] = useState<SelectedInputType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeStage, setActiveStage] = useState<StageDisplayData | null>(null); // State for a single stage
  const [statusText, setStatusText] = useState("");

  const onFileSelected = (f: File) => {
    setFile(f);
    setLink(null);
    setInputType("audio");
    setView(ViewState.ConfirmingInput);
    setStep("configure");
  };
  const onLinkSubmitted = (l: string) => {
    setLink(l);
    setFile(null);
    setInputType("link");
    setView(ViewState.ConfirmingInput);
    setStep("configure");
  };
  const onCancel = useCallback(() => {
    setView(ViewState.SelectingInput);
    setStep("configure");
    setError(null);
  }, [setStep]);

  const onConfirm = async (mode: TranscriptionMode) => {
    setIsSubmitting(true);
    setView(ViewState.Submitting);
    setStep("process");
    setError(null);
    let result: {success: boolean; jobId?: string; error?: string};

    try {
      if (file) {
        setStatusText("Uploading your file...");
        setActiveStage({
          name: "upload",
          label: "Uploading File",
          progress: 0,
          isActive: true,
          isIndeterminate: false,
          subText: "0%",
        });
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/client-upload",
          onUploadProgress: (p) => {
            setActiveStage((prev) =>
              prev
                ? {
                    ...prev,
                    progress: p.percentage / 100,
                  }
                : null
            );
          },
        });
        setStatusText("Creating your job...");
        setActiveStage({
          name: "create",
          label: "Creating Job Record",
          progress: 0,
          isActive: true,
          isIndeterminate: true,
        });
        const hash = await calculateFileHash(file);
        result = await startTranscriptionJob({
          blobUrl: blob.url,
          originalFileName: file.name,
          fileSize: file.size,
          fileHash: hash,
          transcriptionMode: mode,
        });
      } else if (link) {
        setStatusText("Creating your job...");
        setActiveStage({
          name: "create",
          label: "Creating Job Record",
          progress: 0,
          isActive: true,
          isIndeterminate: true,
        });
        result = await startLinkTranscriptionJob({
          linkUrl: link,
          transcriptionMode: mode,
        });
      } else {
        throw new Error("No input selected");
      }

      if (result.success && result.jobId) {
        router.push(`/job/${result.jobId}`);
      } else {
        throw new Error(result.error || "Failed to create job");
      }
    } catch (e: any) {
      setError(e.message);
      setView(ViewState.Error);
    }
    setIsSubmitting(false);
  };

  if (error)
    return (
      <div className="bg-[var(--card-bg)] p-8 rounded-xl shadow-xl w-full max-w-xl mx-auto text-center">
        <h2 className="text-xl font-bold text-red-500">Error</h2>
        <p className="my-4">{error}</p>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded font-semibold"
        >
          Try Again
        </button>
      </div>
    );

  switch (view) {
    case ViewState.SelectingInput:
      return (
        <InputSelectionView
          onFileSelected={onFileSelected}
          onLinkSubmitted={onLinkSubmitted}
        />
      );
    case ViewState.ConfirmingInput:
      return (
        <ConfirmationView
          file={file}
          link={link}
          inputType={inputType}
          onConfirm={(p, m) => onConfirm(m)}
          onCancel={onCancel}
          isSubmitting={isSubmitting}
        />
      );
    case ViewState.Submitting:
      return (
        <ProcessingView
          stage={activeStage}
          currentOverallStatusMessage={statusText}
          appSteps={APP_STEPS}
          currentAppStepId={step}
        />
      );
    default:
      return null;
  }
}

export default function NewTranscriptionPage() {
  return (
    <StepperProvider>
      <NewTranscriptionContent />
    </StepperProvider>
  );
}
