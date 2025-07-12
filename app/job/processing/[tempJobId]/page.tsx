// app/job/processing/[tempJobId]/page.tsx
"use client";

import {useEffect, useState} from "react";
import {useRouter, useParams} from "next/navigation";
import ProcessingView from "@/components/ProcessingView";
import {APP_STEPS, StageDisplayData} from "@/types/app";
import {StepperProvider} from "@/app/contexts/StepperContext";
import StyledButton from "@/components/StyledButton";

const POLLING_INTERVAL = 3000;
const PROCESSING_TIMEOUT = 15 * 60 * 1000; // Increased to 15 mins for large files

// We'll define a type for the polling response for clarity
interface JobStatusResponse {
  id: string;
  status: string;
  errorMessage?: string | null;
  chunks_total?: number | null;
  chunks_completed?: number | null;
}

// This is a simple client-side poller.
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
  const tempJobId = params.tempJobId as string;
  const [error, setError] = useState<string | null>(null);
  // --- NEW STATE FOR DYNAMIC MESSAGES ---
  const [statusMessage, setStatusMessage] = useState(
    "Your transcription is being processed..."
  );
  const [stage, setStage] = useState<StageDisplayData>({
    name: "processing",
    label: "Processing on server...",
    progress: 0,
    isActive: true,
    isIndeterminate: true,
  });

  useEffect(() => {
    if (!tempJobId) return;

    const poll = setInterval(async () => {
      const jobState = await checkJobCompletion(tempJobId);

      if (jobState) {
        // --- NEW DYNAMIC MESSAGE LOGIC ---
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
          case "CHUNKING":
            setStatusMessage("Preparing your large file for processing...");
            setStage((prev) => ({
              ...prev,
              label: "Splitting into chunks...",
              isIndeterminate: true,
            }));
            break;
          case "PROCESSING_CHUNKS":
            const progress = jobState.chunks_total
              ? (jobState.chunks_completed || 0) / jobState.chunks_total
              : 0;
            setStatusMessage(
              `Processing segment ${jobState.chunks_completed || 0} of ${
                jobState.chunks_total
              }...`
            );
            setStage({
              name: "transcribing",
              label: `Transcribing chunk ${jobState.chunks_completed || 0}/${
                jobState.chunks_total
              }`,
              progress,
              isActive: true,
              isIndeterminate: false,
            });
            break;
          case "ASSEMBLING":
            setStatusMessage("Finalizing your transcript...");
            setStage((prev) => ({
              ...prev,
              label: "Assembling transcript...",
              progress: 1,
              isIndeterminate: true,
            }));
            break;
          default:
            // Keep default "Processing" message for other states like PENDING or PROCESSING (for V1)
            break;
        }
      }
    }, POLLING_INTERVAL);

    const timeout = setTimeout(() => {
      clearInterval(poll);
      setError(
        "Processing is taking longer than expected. The job may still be running in the background. Please check your history later."
      );
    }, PROCESSING_TIMEOUT);

    return () => {
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, [tempJobId, router]);

  // --- NEW ERROR UI ---
  if (error) {
    return (
      <div className="bg-[var(--card-bg)] p-8 rounded-xl shadow-xl w-full max-w-xl mx-auto text-center">
        <h2 className="text-xl font-bold text-red-500 mb-4">
          Processing Failed
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
  // --- END ERROR UI ---

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
