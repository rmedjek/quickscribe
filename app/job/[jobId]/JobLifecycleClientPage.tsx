// app/job/[jobId]/JobLifecycleClientPage.tsx
"use client";

import type {TranscriptionJob} from "@prisma/client";
import {useRouter} from "next/navigation";
import {useJobStatus} from "@/hooks/useJobStatus";
import ProcessingView from "@/components/ProcessingView";
import ResultsView from "@/components/ResultsView";
import {APP_STEPS, type StageDisplayData} from "@/types/app";
import type {TranscriptionMode} from "@/components/ConfirmationView";
import {useEffect, useMemo} from "react";
import {StepperProvider, useStepper} from "@/app/contexts/StepperContext";
import {usePage} from "@/app/contexts/PageContext";

function JobStatusDisplay({initialJob}: {initialJob: TranscriptionJob}) {
  const router = useRouter();
  const {job, refetchJob} = useJobStatus(initialJob);
  const {step, setStep} = useStepper();
  const {setPageTitle, setRefetcher} = usePage();

  useEffect(() => {
    setRefetcher(() => refetchJob);
    return () => setRefetcher(() => () => {});
  }, [refetchJob, setRefetcher]);

  useEffect(() => {
    setPageTitle(job.displayTitle || job.sourceFileName, job.id);
    return () => {
      setPageTitle("", null);
    };
  }, [job, setPageTitle]);

  useEffect(() => {
    if (job?.status === "COMPLETED" || job?.status === "FAILED") {
      setStep("transcribe");
    } else {
      setStep("process");
    }
  }, [job?.status, setStep]);

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
