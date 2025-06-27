/* eslint-disable @typescript-eslint/no-explicit-any */
// app/page.tsx
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
import PageLayout from "@/components/PageLayout";
import InputSelectionView from "@/components/InputSelectionView";
import ConfirmationView, {
  TranscriptionMode,
} from "@/components/ConfirmationView";
import ProcessingView from "@/components/ProcessingView";
import {StepperProvider, useStepper} from "./contexts/StepperContext";

enum ViewState {
  SelectingInput,
  ConfirmingInput,
  Submitting,
  Error,
}

function HomePageInner() {
  const {setStep, step} = useStepper();
  const router = useRouter();

  const [currentView, setCurrentView] = useState<ViewState>(
    ViewState.SelectingInput
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submittedLink, setSubmittedLink] = useState<string | null>(null);
  const [selectedInputType, setSelectedInputType] =
    useState<SelectedInputType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  // NEW: State for the single active stage during submission
  const [activeSubmissionStage, setActiveSubmissionStage] =
    useState<StageDisplayData | null>(null);
  const [currentSubmissionStatusText, setCurrentSubmissionStatusText] =
    useState("");

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setSubmittedLink(null);
    setSelectedInputType(file.type.startsWith("audio/") ? "audio" : "video");
    setCurrentView(ViewState.ConfirmingInput);
    setStep("configure");
  };

  const handleLinkSubmitted = (link: string) => {
    setSubmittedLink(link);
    setSelectedFile(null);
    setSelectedInputType("link");
    setCurrentView(ViewState.ConfirmingInput);
    setStep("configure");
  };

  const handleConfirmation = async (mode: TranscriptionMode) => {
    setIsSubmittingJob(true);
    setCurrentView(ViewState.Submitting);
    setStep("process");
    setErrorMessage(null);

    let result: {success: boolean; jobId?: string; error?: string};

    if (selectedFile) {
      setCurrentSubmissionStatusText("Preparing your file...");
      setActiveSubmissionStage({
        name: "upload",
        label: "Uploading File",
        progress: 0,
        isActive: true,
        isIndeterminate: false,
        subText: "0%",
      });

      try {
        const uploadResult = await upload(selectedFile.name, selectedFile, {
          access: "public",
          handleUploadUrl: "/api/client-upload",
          onUploadProgress: (progressEvent) => {
            const percent = Math.round(progressEvent.percentage);
            setActiveSubmissionStage((prev: any) =>
              prev
                ? {...prev, progress: percent / 100, subText: `${percent}%`}
                : null
            );
          },
        });

        setActiveSubmissionStage({
          name: "upload",
          label: "File Uploaded Successfully",
          progress: 1,
          isActive: false,
          isComplete: true,
          subText: "100%",
        });

        setCurrentSubmissionStatusText("Finalizing your transcription job...");
        setActiveSubmissionStage({
          name: "create_job",
          label: "Creating Job Record",
          progress: 0,
          isActive: true,
          isIndeterminate: true,
          subText: "Sending to server...",
        });

        const fileHash = await calculateFileHash(selectedFile);
        result = await startTranscriptionJob({
          blobUrl: uploadResult.url,
          originalFileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileHash,
          transcriptionMode: mode,
        });
      } catch (uploadError: any) {
        setErrorMessage(
          `Upload Error: ${uploadError.message || "Failed to upload file."}`
        );
        setCurrentView(ViewState.Error);
        setIsSubmittingJob(false);
        return;
      }
    } else if (submittedLink) {
      setCurrentSubmissionStatusText("Submitting your link...");
      setActiveSubmissionStage({
        name: "create_job",
        label: "Creating Job Record",
        progress: 0,
        isActive: true,
        isIndeterminate: true,
        subText: "Sending to server...",
      });

      result = await startLinkTranscriptionJob({
        linkUrl: submittedLink,
        transcriptionMode: mode,
      });
    } else {
      setErrorMessage("No file or link selected.");
      setCurrentView(ViewState.Error);
      setIsSubmittingJob(false);
      return;
    }

    if (result.success && result.jobId) {
      setActiveSubmissionStage((prev: any) =>
        prev
          ? {
              ...prev,
              progress: 1,
              isActive: false,
              isComplete: true,
              label: "Job Created",
            }
          : null
      );
      setCurrentSubmissionStatusText("Job submitted! Redirecting...");
      setTimeout(() => router.push(`/dashboard/job/${result.jobId}`), 1000);
    } else {
      setErrorMessage(
        result.error || "Server failed to create the job record."
      );
      setCurrentView(ViewState.Error);
      setIsSubmittingJob(false);
    }
  };

  const resetToStart = useCallback(() => {
    setSelectedFile(null);
    setSubmittedLink(null);
    setCurrentView(ViewState.SelectingInput);
    setStep("configure");
    setErrorMessage(null);
    setIsSubmittingJob(false);
    setActiveSubmissionStage(null);
  }, [setStep]);

  if (errorMessage) {
    return (
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-xl w-full max-w-lg mx-auto text-center">
        <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">
          Submission Error
        </h2>
        <p className="text-slate-600 dark:text-slate-300 mb-6">
          {errorMessage}
        </p>
        <button
          onClick={resetToStart}
          className="mt-4 px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 font-semibold"
        >
          Try Again
        </button>
      </div>
    );
  }

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
          onConfirm={(path, mode) => handleConfirmation(mode)}
          onCancel={resetToStart}
          isSubmitting={isSubmittingJob}
        />
      );
    case ViewState.Submitting:
      return (
        <ProcessingView
          activeStage={activeSubmissionStage}
          currentOverallStatusMessage={currentSubmissionStatusText}
          appSteps={APP_STEPS}
          currentAppStepId={step}
        />
      );
    default:
      return null;
  }
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
