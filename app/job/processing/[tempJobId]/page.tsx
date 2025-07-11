// app/job/processing/[tempJobId]/page.tsx
"use client";

import {useEffect, useState} from "react";
import {useRouter, useParams} from "next/navigation";
import ProcessingView from "@/components/ProcessingView";
import {APP_STEPS, StageDisplayData} from "@/types/app";
import {StepperProvider} from "@/app/contexts/StepperContext";
import StyledButton from "@/components/StyledButton";

// Polling interval in milliseconds
const POLLING_INTERVAL = 3000;
// Timeout after 5 minutes (300,000 ms)
const PROCESSING_TIMEOUT = 5 * 60 * 1000;

// This is a simple client-side poller.
async function checkJobCompletion(identifier: string) {
  try {
    console.log(`Polling for job with identifier: ${identifier}`);
    const res = await fetch(`/api/find-job/${identifier}`);

    if (res.ok) {
      const job = await res.json();
      console.log("Job found:", job);
      return job;
    } else if (res.status === 404) {
      console.log("Job not found yet (404), continuing to poll...");
      return null;
    } else if (res.status === 401) {
      console.error("Unauthorized - session may have expired");
      return null;
    } else {
      console.error("Unexpected response status:", res.status);
      return null;
    }
  } catch (error) {
    console.error("Polling failed:", error);
    return null;
  }
}

export default function JobProcessingPage() {
  const router = useRouter();
  const params = useParams();
  const tempJobId = params.tempJobId as string;
  const [error, setError] = useState<string | null>(null); // <-- Add error state

  const processingStage: StageDisplayData = {
    name: "processing",
    label: "Processing on server...",
    progress: 0,
    isActive: true,
    isIndeterminate: true,
  };

  useEffect(() => {
    if (!tempJobId) return;

    // --- POLLING LOGIC WITH TIMEOUT ---
    const poll = setInterval(async () => {
      try {
        const finalJob = await checkJobCompletion(tempJobId);
        if (finalJob) {
          clearInterval(poll);
          clearTimeout(timeout); // Clear the timeout if we get a result
          if (finalJob.status === "COMPLETED") {
            router.push(`/job/${finalJob.id}`);
          } else {
            // It must be FAILED
            setError(
              finalJob.errorMessage || "The job failed for an unknown reason."
            );
          }
        }
      } catch (e) {
        // This catches network errors during polling
        console.error("Polling check failed:", e);
      }
    }, POLLING_INTERVAL);

    // Set a timeout to stop polling after a while
    const timeout = setTimeout(() => {
      clearInterval(poll);
      setError(
        "Processing is taking longer than expected. Please check your history later or try again."
      );
    }, PROCESSING_TIMEOUT);
    // --- END POLLING LOGIC ---

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
        stage={processingStage}
        currentOverallStatusMessage="Your transcription is being processed..."
        appSteps={APP_STEPS}
        currentAppStepId="process"
      />
    </StepperProvider>
  );
}
