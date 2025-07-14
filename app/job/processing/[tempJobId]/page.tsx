// app/job/processing/[tempJobId]/page.tsx
"use client";

import {useEffect, useState} from "react";
import {useRouter, useParams} from "next/navigation";
import ProcessingView from "@/components/ProcessingView";
import {APP_STEPS, StageDisplayData} from "@/types/app";
import {StepperProvider} from "@/app/contexts/StepperContext";
import StyledButton from "@/components/StyledButton";

const POLLING_INTERVAL = 3000; // 3 seconds
// Increased timeout for potentially very long sequential jobs
const PROCESSING_TIMEOUT = 30 * 60 * 1000; // 30 minutes

interface JobStatusResponse {
  id: string;
  status: string;
  errorMessage?: string | null;
  processing_strategy?: string | null;
  chunks_total?: number | null;
  chunks_completed?: number | null;
}

async function checkJobCompletion(
  identifier: string
): Promise<JobStatusResponse | null> {
  try {
    const res = await fetch(`/api/find-job/${identifier}`);
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch (error) {
    console.error("Polling failed:", error);
    return null;
  }
}

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
      const jobState = await checkJobCompletion(jobId);

      if (jobState) {
        switch (jobState.status) {
          case "COMPLETED":
            clearInterval(poll);
            clearTimeout(timeout);
            router.push(`/job/${jobState.id}`);
            break;
          case "FAILED":
            clearInterval(poll);
            clearTimeout(timeout);
            setError(
              jobState.errorMessage || "The job failed for an unknown reason."
            );
            break;

          // V1 Status
          case "PROCESSING":
            setStatusMessage("Transcribing your media...");
            setStage((prev) => ({
              ...prev,
              label: "Transcription in progress...",
              isIndeterminate: true,
            }));
            break;

          // V2 Statuses
          case "CHUNKING":
            setStatusMessage("Preparing your large file...");
            setStage((prev) => ({
              ...prev,
              label: "Splitting into manageable chunks...",
              isIndeterminate: true,
            }));
            break;
          case "PROCESSING_CHUNKS":
            const total = jobState.chunks_total || 1;
            const completed = jobState.chunks_completed || 0;
            const progress = total > 0 ? completed / total : 0;
            setStatusMessage(`Processing segment ${completed} of ${total}...`);
            setStage({
              name: "transcribing",
              label: `Transcribing chunk ${completed}/${total}`,
              progress,
              isActive: true,
              isIndeterminate: false,
            });
            break;
          case "ASSEMBLING":
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

  if (error) {
    return (
      <div className="bg-[var(--card-bg)] p-8 rounded-xl shadow-xl w-full max-w-xl mx-auto text-center">
        <h2 className="text-xl font-bold text-red-500 mb-4">
          An Error Occurred
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
    );
  }

  return (
    <StepperProvider>
      <ProcessingView
        stage={stage}
        currentOverallStatusMessage={statusMessage}
        appSteps={APP_STEPS}
        currentAppStepId="process"
      />
    </StepperProvider>
  );
}
