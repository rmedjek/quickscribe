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
import {type SelectedInputType, APP_STEPS} from "@/types/app";
import PageLayout from "@/components/PageLayout";
import InputSelectionView from "@/components/InputSelectionView";
import ConfirmationView, {
  TranscriptionMode,
} from "@/components/ConfirmationView";
import ProcessingView, {StageDisplayData} from "@/components/ProcessingView";
import {StepperProvider, useStepper} from "./contexts/StepperContext";

enum ViewState {
  SelectingInput,
  ConfirmingInput,
  Submitting, // This state will use the ProcessingView
  Error,
}

const UPLOAD_STAGE_NAME = "upload";
const CREATE_JOB_STAGE_NAME = "create_job";

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

  const [isSubmittingJob, setIsSubmittingJob] = useState(false); // Tracks the overall submission
  const [submissionStages, setSubmissionStages] = useState<StageDisplayData[]>(
    []
  );
  const [currentSubmissionStatusText, setCurrentSubmissionStatusText] =
    useState("");

  const updateSubmissionStage = useCallback(
    (name: string, partial: Partial<StageDisplayData>) => {
      setSubmissionStages((prev) =>
        prev.map((s) => (s.name === name ? {...s, ...partial} : s))
      );
    },
    []
  );

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
    setStep("process"); // Set stepper to "Process Audio"
    setErrorMessage(null);

    let result: {success: boolean; jobId?: string; error?: string};

    if (selectedFile) {
      setCurrentSubmissionStatusText("Preparing your file for upload...");
      setSubmissionStages([
        {
          name: UPLOAD_STAGE_NAME,
          label: "Uploading File",
          progress: 0,
          isActive: true,
          isIndeterminate: false,
          subText: "0%",
        },
        {
          name: CREATE_JOB_STAGE_NAME,
          label: "Creating Job Record",
          progress: 0,
          isActive: false,
          isIndeterminate: true,
        }, // Will become determinate
      ]);

      try {
        const uploadResult = await upload(selectedFile.name, selectedFile, {
          access: "public",
          handleUploadUrl: "/api/client-upload",
          onUploadProgress: (progressEvent) => {
            const percent = Math.round(progressEvent.percentage);
            updateSubmissionStage(UPLOAD_STAGE_NAME, {
              progress: percent / 100,
              subText: `${percent}%`,
            });
          },
        });

        updateSubmissionStage(UPLOAD_STAGE_NAME, {
          progress: 1,
          isActive: false,
          isComplete: true,
          label: "File Uploaded Successfully",
          subText: "100%",
        });

        setCurrentSubmissionStatusText("Finalizing your transcription job...");
        updateSubmissionStage(CREATE_JOB_STAGE_NAME, {
          isActive: true,
          isIndeterminate: false,
          progress: 0.1,
          subText: "Sending to server...",
        });

        const finalizeInterval = setInterval(() => {
          setSubmissionStages((prev) =>
            prev.map((s) =>
              s.name === CREATE_JOB_STAGE_NAME
                ? {...s, progress: Math.min(s.progress + 0.2, 0.9)}
                : s
            )
          );
        }, 150); // Animate progress for this short step

        const fileHash = await calculateFileHash(selectedFile);
        result = await startTranscriptionJob({
          blobUrl: uploadResult.url,
          originalFileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileHash,
          transcriptionMode: mode,
        });
        clearInterval(finalizeInterval);
      } catch (uploadError: any) {
        setErrorMessage(
          `Upload Error: ${uploadError.message || "Failed to upload file."}`
        );
        setCurrentView(ViewState.Error);
        setIsSubmittingJob(false);
        return;
      }
    } else if (submittedLink) {
      setCurrentSubmissionStatusText("Creating your transcription job...");
      setSubmissionStages([
        {
          name: CREATE_JOB_STAGE_NAME,
          label: "Creating Job Record",
          progress: 0,
          isActive: true,
          isIndeterminate: false,
          subText: "Sending to server...",
        },
      ]);
      const finalizeInterval = setInterval(() => {
        setSubmissionStages((prev) =>
          prev.map((s) =>
            s.name === CREATE_JOB_STAGE_NAME
              ? {...s, progress: Math.min(s.progress + 0.2, 0.9)}
              : s
          )
        );
      }, 150);

      result = await startLinkTranscriptionJob({
        linkUrl: submittedLink,
        transcriptionMode: mode,
      });
      clearInterval(finalizeInterval);
    } else {
      setErrorMessage("No file or link selected.");
      setCurrentView(ViewState.Error);
      setIsSubmittingJob(false);
      return;
    }

    if (result.success && result.jobId) {
      updateSubmissionStage(CREATE_JOB_STAGE_NAME, {
        progress: 1,
        isActive: false,
        isComplete: true,
        label: "Job Created",
        subText: "100%",
      });
      setCurrentSubmissionStatusText(
        "Job submitted! Redirecting to your dashboard..."
      );
      setTimeout(() => router.push(`/dashboard/job/${result.jobId}`), 1200);
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
          onConfirm={(path, mode) => handleConfirmation(mode)} // Path is ignored now
          onCancel={resetToStart}
          isSubmitting={isSubmittingJob}
        />
      );
    case ViewState.Submitting:
      return (
        <ProcessingView
          stages={submissionStages}
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
