// app/dashboard/job/[jobId]/JobLifecycleClientPage.tsx
"use client";

import type {TranscriptionJob} from "@prisma/client";
import {useRouter} from "next/navigation";
import {useJobStatus} from "@/hooks/useJobStatus";
import ProcessingView, {StageDisplayData} from "@/components/ProcessingView";
import ResultsView from "@/components/ResultsView";
import {APP_STEPS} from "@/types/app"; // Import StageDisplayData
import type {TranscriptionMode} from "@/components/ConfirmationView";
import {useEffect} from "react";
import {useStepper} from "@/app/contexts/StepperContext";

export default function JobLifecycleClientPage({
  initialJob,
}: {
  initialJob: TranscriptionJob;
}) {
  const router = useRouter();
  const job = useJobStatus(initialJob);
  const {setStep, step} = useStepper(); // Get stepper context

  // Update stepper based on job status
  useEffect(() => {
    if (job.status === "PENDING" || job.status === "PROCESSING") {
      setStep("process");
    } else if (job.status === "COMPLETED" || job.status === "FAILED") {
      setStep("transcribe");
    }
  }, [job.status, setStep]);

  if (!job) return <div>Loading Job Details...</div>; // Should not happen if initialJob is always passed

  if (job.status === "PENDING" || job.status === "PROCESSING") {
    const processingStages: StageDisplayData[] = [
      {
        name: "queue",
        label: "Job Queued",
        progress: job.status === "PENDING" ? 0 : 1,
        isActive: job.status === "PENDING",
        isComplete: job.status !== "PENDING",
        isIndeterminate: job.status === "PENDING",
      },
      {
        name: "transcribing",
        label: "Transcribing Media",
        progress: 0,
        isActive: job.status === "PROCESSING",
        isComplete: false,
        isIndeterminate: job.status === "PROCESSING",
      },
    ];
    return (
      <ProcessingView
        stages={processingStages}
        currentOverallStatusMessage={
          job.status === "PENDING"
            ? "Your job is in the queue..."
            : "Processing your media..."
        }
        appSteps={APP_STEPS}
        currentAppStepId={step} // Use step from context
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
      <div className="text-red-500 text-center p-8">
        <h2>Transcription Failed</h2>
        <p>{job.errorMessage || "An unknown error occurred."}</p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 px-4 py-2 bg-slate-200 rounded"
        >
          New Transcription
        </button>
      </div>
    );
  }

  return <div>Loading job status...</div>;
}
