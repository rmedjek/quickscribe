// app/job/processing/[tempJobId]/page.tsx
"use client";

import {useEffect, useState} from "react";
import {useRouter, useParams} from "next/navigation";
import ProcessingView from "@/components/ProcessingView";
import {APP_STEPS, StageDisplayData} from "@/types/app";
import {StepperProvider} from "@/app/contexts/StepperContext";

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
  const [pollCount, setPollCount] = useState(0);

  const processingStage: StageDisplayData = {
    name: "processing",
    label: "Processing on server...",
    progress: 0,
    isActive: true,
    isIndeterminate: true,
  };

  useEffect(() => {
    if (!tempJobId) {
      console.error("No tempJobId found in params");
      return;
    }

    console.log(`Starting to poll for job with tempJobId: ${tempJobId}`);
    console.log(`Decoded tempJobId might be: ${decodeURIComponent(tempJobId)}`);

    const interval = setInterval(async () => {
      setPollCount((prev) => {
        const newCount = prev + 1;
        console.log(`Poll attempt #${newCount}`);
        return newCount;
      });

      const finalJob = await checkJobCompletion(tempJobId);
      if (finalJob && finalJob.id) {
        console.log("Job completed! Redirecting to:", `/job/${finalJob.id}`);
        clearInterval(interval);
        router.push(`/job/${finalJob.id}`);
      } else if (pollCount >= 40) {
        // Stop after 2 minutes (40 * 3 seconds)
        console.log("Polling timeout reached - stopping");
        clearInterval(interval);
        // Optionally show error or redirect
        alert(
          "Job processing is taking longer than expected. Please check back later."
        );
      }
    }, 3000);

    return () => {
      console.log("Cleaning up polling interval");
      clearInterval(interval);
    };
  }, [tempJobId, router, pollCount]);

  return (
    <StepperProvider>
      <ProcessingView
        stage={processingStage}
        currentOverallStatusMessage={`Your transcription is being processed... `}
        appSteps={APP_STEPS}
        currentAppStepId="process"
      />
    </StepperProvider>
  );
}
