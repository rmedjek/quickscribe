// app/job/processing/[tempJobId]/page.tsx
"use client";

import {useEffect} from "react";
import {useRouter, useParams} from "next/navigation";
import {usePage} from "@/app/contexts/PageContext";
import ProcessingView from "@/components/ProcessingView";
import {APP_STEPS, StageDisplayData} from "@/types/app";
import {StepperProvider} from "@/app/contexts/StepperContext";

// This is a simple client-side poller.
async function checkJobCompletion(identifier: string) {
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

  // const {setPageTitle} = usePage();
  const processingStage: StageDisplayData = {
    name: "processing",
    label: "Processing on server...",
    progress: 0,
    isActive: true,
    isIndeterminate: true,
  };

  // useEffect(() => {
  //   setPageTitle("Processing Transcription");
  //   return () => setPageTitle("");
  // }, [setPageTitle]);

  useEffect(() => {
    if (!tempJobId) return;

    const interval = setInterval(async () => {
      const finalJob = await checkJobCompletion(tempJobId);
      if (finalJob && finalJob.id) {
        clearInterval(interval);
        router.push(`/job/${finalJob.id}`);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [tempJobId, router]);

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
