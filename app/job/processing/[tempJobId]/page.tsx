// app/job/processing/[tempJobId]/page.tsx
"use client";

import {useEffect, useState} from "react";
import {useRouter, useParams} from "next/navigation";
import ProcessingView from "@/components/ProcessingView";
import {APP_STEPS, StageDisplayData} from "@/types/app";
import {StepperProvider} from "@/app/contexts/StepperContext";
import StyledButton from "@/components/StyledButton";
import PageLayout from "@/components/PageLayout";
import {getJobStatusAction} from "@/actions/jobActions"; // <-- IMPORT THE SERVER ACTION
import {JobStatus} from "@prisma/client";

const POLLING_INTERVAL = 3000;
const PROCESSING_TIMEOUT = 30 * 60 * 1000; // 30 minutes

type JobStatePayload = {
  id: string;
  status: JobStatus;
  errorMessage: string | null;
  processing_strategy: string | null;
  chunks_total: number | null;
  chunks_completed: number | null;
};

export default function JobProcessingPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.tempJobId as string;
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    "Your transcription is being prepared..."
  );
  const [stage, setStage] = useState<StageDisplayData>({
    name: "preparing",
    label: "Preparing...",
    progress: 0,
    isActive: true,
    isIndeterminate: true,
  });

  useEffect(() => {
    if (!jobId) return;

    const poll = setInterval(async () => {
      // Call the server action directly instead of using fetch
      const result = await getJobStatusAction(jobId);

      if (result.success && result.job) {
        const jobState = result.job as JobStatePayload;
        switch (jobState.status) {
          case JobStatus.COMPLETED:
            clearInterval(poll);
            clearTimeout(timeout);
            router.push(`/job/${jobState.id}`);
            break;
          case JobStatus.FAILED:
            clearInterval(poll);
            clearTimeout(timeout);
            setError(
              jobState.errorMessage || "The job failed for an unknown reason."
            );
            break;
          case JobStatus.PROCESSING:
            setStatusMessage("Transcribing your media...");
            setStage((prev) => ({
              ...prev,
              label: "Transcription in progress...",
              isIndeterminate: true,
            }));
            break;
          case JobStatus.CHUNKING:
            setStatusMessage("Preparing your large file...");
            setStage((prev) => ({
              ...prev,
              label: "Splitting into manageable chunks...",
              isIndeterminate: true,
            }));
            break;
          case JobStatus.PROCESSING_CHUNKS:
            const total = jobState.chunks_total || 1;
            const completed = jobState.chunks_completed || 0;
            const progress = total > 0 ? completed / total : 0;
            setStatusMessage(
              `Processing segment ${completed + 1} of ${total}...`
            );
            setStage({
              name: "transcribing",
              label: `Transcribing chunk ${completed + 1}/${total}`,
              progress,
              isActive: true,
              isIndeterminate: false,
            });
            break;
          case JobStatus.ASSEMBLING:
            setStatusMessage("Finalizing your transcript...");
            setStage((prev) => ({
              ...prev,
              label: "Assembling final result...",
              progress: 1,
              isIndeterminate: true,
            }));
            break;
        }
      }
    }, POLLING_INTERVAL);

    const timeout = setTimeout(() => {
      clearInterval(poll);
      setError(
        "Processing is taking longer than expected. The job may still be running in the background. Please check your history later for updates."
      );
    }, PROCESSING_TIMEOUT);

    return () => {
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, [jobId, router]);

  return (
    <PageLayout>
      {error ? (
        <div className="bg-[var(--card-bg)] p-8 rounded-xl shadow-xl w-full max-w-xl mx-auto text-center">
          <h2 className="text-xl font-bold text-red-500 mb-4">
            Processing Error
          </h2>
          <p className="my-4 text-[var(--text-primary)]">{error}</p>
          <StyledButton
            variant="primary"
            onClick={() => router.push("/")}
            className="mt-4"
          >
            Start New Transcription
          </StyledButton>
        </div>
      ) : (
        <StepperProvider>
          <ProcessingView
            stage={stage}
            currentOverallStatusMessage={statusMessage}
            appSteps={APP_STEPS}
            currentAppStepId="process"
          />
        </StepperProvider>
      )}
    </PageLayout>
  );
}
