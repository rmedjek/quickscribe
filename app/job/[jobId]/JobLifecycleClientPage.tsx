// app/dashboard/job/[jobId]/JobLifecycleClientPage.tsx
"use client";

import type {TranscriptionJob} from "@prisma/client";
import {useRouter} from "next/navigation";
import {useJobStatus} from "@/hooks/useJobStatus";
import ProcessingView from "@/components/ProcessingView";
import ResultsView from "@/components/ResultsView";
import {APP_STEPS, type StageDisplayData} from "@/types/app";
import type {TranscriptionMode} from "@/components/ConfirmationView";
import {getJobAction} from "@/actions/jobActions";
import {useEffect, useMemo} from "react";
import {StepperProvider, useStepper} from "@/app/contexts/StepperContext";

function JobStatusDisplay({initialJob}: {initialJob: TranscriptionJob}) {
  const router = useRouter();
  const job = useJobStatus(initialJob, getJobAction); // This hook correctly polls for data.
  const {setStep, step} = useStepper();

  useEffect(() => {
    if (job?.status === "COMPLETED" || job?.status === "FAILED") {
      setStep("transcribe");
    } else {
      setStep("process");
    }
  }, [job?.status, setStep]);

  // --- THIS IS THE DEFINITIVE FIX for stage transitions ---
  const {stage, overallStatusMessage} = useMemo((): {
    stage: StageDisplayData | null;
    overallStatusMessage: string;
  } => {
    if (!job) return {stage: null, overallStatusMessage: "Loading..."};

    switch (job.status) {
      case "PENDING":
        return {
          overallStatusMessage: "Your transcription is in the queue",
          stage: {
            name: "queue",
            label: "Waiting for worker...",
            progress: 0,
            isActive: true,
            isIndeterminate: true,
          },
        };
      case "PROCESSING":
        // This logic now correctly reads the sub-stage from the database.
        if (job.processingSubStage === "TRANSCRIBING") {
          return {
            overallStatusMessage: "AI is creating your transcript...",
            stage: {
              name: "transcribing",
              label: "AI Transcription",
              progress: 0,
              isActive: true,
              isIndeterminate: true,
              subText: "This may take a few seconds...",
            },
          };
        }
        // The default sub-stage is preparing the file.
        return {
          overallStatusMessage: "Preparing your audio file...",
          stage: {
            name: "processing",
            label: "Processing File",
            progress: 0,
            isActive: true,
            isIndeterminate: true,
            subText: "Extracting audio...",
          },
        };
      default:
        return {stage: null, overallStatusMessage: ""};
    }
  }, [job]);
  // --- END FIX ---

  if (!job)
    return <div className="p-8 text-center">Loading Job Details...</div>;

  if (job.status === "PENDING" || job.status === "PROCESSING") {
    return (
      <ProcessingView
        stage={stage}
        currentOverallStatusMessage={overallStatusMessage}
        appSteps={APP_STEPS}
        currentAppStepId={step}
      />
    );
  }

  if (job.status === "COMPLETED") {
    const transcriptionData = {
      text: job.transcriptText || "",
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

  if (job.status === "FAILED")
    return (
      <div className="p-8 text-center text-red-500">
        <h2>Job Failed</h2>
        <p>{job.errorMessage}</p>
      </div>
    );

  return <div className="p-8 text-center">Loading job status...</div>;
}

export default function JobLifecycleClientPage({
  initialJob,
}: {
  initialJob: TranscriptionJob;
}) {
  return (
    <StepperProvider>
      <JobStatusDisplay initialJob={initialJob} />
    </StepperProvider>
  );
}
