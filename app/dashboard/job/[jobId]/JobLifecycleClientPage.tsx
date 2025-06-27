// app/dashboard/job/[jobId]/JobLifecycleClientPage.tsx
"use client";

import type {TranscriptionJob} from "@prisma/client";
import {useRouter} from "next/navigation";
import {useJobStatus} from "@/hooks/useJobStatus";
import ProcessingView from "@/components/ProcessingView";
import ResultsView from "@/components/ResultsView";
import {APP_STEPS} from "@/types/app";
import type {TranscriptionMode} from "@/components/ConfirmationView";
import {useEffect, useMemo} from "react";
import {useStepper} from "@/app/contexts/StepperContext";

export default function JobLifecycleClientPage({
  initialJob,
}: {
  initialJob: TranscriptionJob;
}) {
  const router = useRouter();
  const job = useJobStatus(initialJob);
  const {setStep, step} = useStepper();

  useEffect(() => {
    if (job.status === "PENDING" || job.status === "PROCESSING") {
      setStep("process");
    } else if (job.status === "COMPLETED" || job.status === "FAILED") {
      setStep("transcribe");
    }
  }, [job.status, setStep]);

  // Determine the active stage and overall message based on job status
  const {activeProcessingStage, overallStatusMessage} = useMemo(() => {
    if (!job)
      return {
        activeProcessingStage: null,
        overallStatusMessage: "Loading job details...",
      };

    switch (job.status) {
      case "PENDING":
        return {
          activeProcessingStage: {
            name: "queue",
            label: "Job Queued",
            progress: 0,
            isActive: true,
            isIndeterminate: true,
            subText: "Waiting for an available worker...",
          },
          overallStatusMessage: "Your transcription is in the queue",
        };
      case "PROCESSING":
        return {
          activeProcessingStage: {
            name: "transcribing",
            label: "Transcribing Media",
            progress: 0,
            isActive: true,
            isIndeterminate: true,
            subText: "This may take a few minutes...",
          },
          overallStatusMessage: "Your transcription is in progress",
        };
      default:
        return {
          activeProcessingStage: null,
          overallStatusMessage: "Loading...",
        };
    }
  }, [job]);

  if (!job)
    return <div className="text-center p-8">Loading Job Details...</div>;

  if (job.status === "PENDING" || job.status === "PROCESSING") {
    return (
      <ProcessingView
        activeStage={activeProcessingStage}
        currentOverallStatusMessage={overallStatusMessage}
        appSteps={APP_STEPS}
        currentAppStepId={step}
      />
    );
  }

  if (job.status === "COMPLETED") {
    const transcriptionData = {
      text: job.transcriptText || "",
      language: job.language || "en",
      duration: job.duration || 0,
      segments: [],
      srtContent: job.transcriptSrt || "",
      vttContent: job.transcriptVtt || "",
    };
    return (
      <ResultsView
        transcriptionData={transcriptionData}
        transcriptLanguage={job.language || "en"}
        mode={job.engineUsed as TranscriptionMode}
        onRestart={() => router.push("/")}
      />
    );
  }

  if (job.status === "FAILED") {
    return (
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-xl w-full max-w-lg mx-auto text-center">
        <h2 className="text-2xl font-bold text-red-500 dark:text-red-400 mb-4">
          Transcription Failed
        </h2>
        <p className="text-slate-600 dark:text-slate-300 mb-6">
          Unfortunately, we encountered an error.
        </p>
        {job.errorMessage && (
          <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-md text-red-700 dark:text-red-200 text-sm text-left mb-6">
            <p>
              <strong>Error Details:</strong> {job.errorMessage}
            </p>
          </div>
        )}
        <button
          onClick={() => router.push("/")}
          className="mt-4 px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 font-semibold"
        >
          New Transcription
        </button>
      </div>
    );
  }

  return <div className="text-center p-8">Loading job status...</div>;
}
