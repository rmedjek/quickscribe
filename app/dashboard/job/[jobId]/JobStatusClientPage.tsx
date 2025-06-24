// app/dashboard/job/[jobId]/JobStatusClientPage.tsx
"use client";

import type {TranscriptionJob} from "@prisma/client";
import {useRouter} from "next/navigation";

// CORRECTED: We import the server action HERE, in a Client Component, which is the correct pattern.
import {getJobAction} from "@/actions/jobActions";

import ProcessingView from "@/components/ProcessingView";
import ResultsView from "@/components/ResultsView";
import StyledButton from "@/components/StyledButton";
import {APP_STEPS} from "@/types/app";
import type {TranscriptionMode} from "@/components/ConfirmationView";
import {useJobStatus} from "@/app/hooks/useJobStatus";

interface Props {
  initialJob: TranscriptionJob;
}

export default function JobStatusClientPage({initialJob}: Props) {
  // We now pass the Server Action directly into the hook.
  const job = useJobStatus(initialJob, getJobAction);
  const router = useRouter();

  if (!job) {
    return <div>Loading job status...</div>;
  }

  const handleRestart = () => {
    router.push("/");
  };

  switch (job.status) {
    case "PENDING":
    case "PROCESSING":
      return (
        <ProcessingView
          stages={[]}
          currentOverallStatusMessage={
            job.status === "PENDING"
              ? "Your job is in the queue..."
              : "Processing your media..."
          }
          appSteps={APP_STEPS}
          currentAppStepId="process"
        />
      );

    case "COMPLETED":
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
          onRestart={handleRestart}
        />
      );

    case "FAILED":
      return (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-xl w-full max-w-lg mx-auto text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">
            Transcription Failed
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mb-6 break-words">
            Unfortunately, we encountered an error while processing your job.
          </p>
          {job.errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md text-red-700 dark:text-red-200 text-sm text-left mb-6">
              <p>
                <strong>Error Details:</strong> {job.errorMessage}
              </p>
            </div>
          )}
          <StyledButton onClick={handleRestart} variant="secondary">
            Start a New Transcription
          </StyledButton>
        </div>
      );

    default:
      return <div>Unknown job status.</div>;
  }
}
