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

  const {activeProcessingStage, overallStatusMessage} = useMemo(() => {
    if (!job)
      return {activeProcessingStage: null, overallStatusMessage: "Loading..."};
    switch (job.status) {
      case "PENDING":
        return {
          activeProcessingStage: {
            name: "queue",
            label: "Job Queued",
            progress: 0,
            isActive: true,
            isIndeterminate: true,
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
        return {activeProcessingStage: null, overallStatusMessage: ""};
    }
  }, [job]);

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
      <div className="text-red-500 text-center p-8">
        <h2>Transcription Failed</h2>
        <p>{job.errorMessage || "An unknown error occurred."}</p>
        <button onClick={() => router.push("/")}>New Transcription</button>
      </div>
    );
  }

  return <div>Loading job status...</div>;
}
