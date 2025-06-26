// app/hooks/useJobSubmission.ts
"use client";

import {useState, useCallback, useEffect} from "react";
import {upload} from "@vercel/blob/client";
import {
  startTranscriptionJob,
  startLinkTranscriptionJob,
  getJobAction,
} from "@/actions/jobActions";
import {calculateFileHash} from "@/lib/hash-utils";
import type {TranscriptionJob} from "@prisma/client";
import type {TranscriptionMode} from "@/components/ConfirmationView";

// This is a new helper hook for polling that we extract from the old useJobStatus
function useJobPoller(
  job: TranscriptionJob | null,
  getJobAction: (jobId: string) => Promise<TranscriptionJob | null>
) {
  const [polledJob, setPolledJob] = useState(job);

  const isProcessing =
    polledJob?.status === "PENDING" || polledJob?.status === "PROCESSING";
  const [pollInterval, setPollInterval] = useState<number | null>(
    isProcessing ? 2000 : null
  );

  const poll = useCallback(async () => {
    if (!polledJob?.id) return;
    try {
      const updatedJob = await getJobAction(polledJob.id);
      if (updatedJob) {
        setPolledJob(updatedJob);
        if (
          updatedJob.status === "COMPLETED" ||
          updatedJob.status === "FAILED"
        ) {
          setPollInterval(null);
        } else {
          setPollInterval((prev) =>
            prev ? Math.min(prev * 1.5, 30000) : null
          );
        }
      }
    } catch (error) {
      console.error("Failed to poll for job status:", error);
      setPollInterval(null);
    }
  }, [polledJob?.id, getJobAction]);

  useEffect(() => {
    setPolledJob(job);
    const shouldPoll =
      job?.status === "PENDING" || job?.status === "PROCESSING";
    setPollInterval(shouldPoll ? 2000 : null);
  }, [job]);

  useEffect(() => {
    if (pollInterval === null) return;
    const intervalId = setInterval(poll, pollInterval);
    return () => clearInterval(intervalId);
  }, [pollInterval, poll]);

  return polledJob;
}

// This is the main hook for the UI to use
export function useJobSubmission() {
  const [internalJob, setInternalJob] = useState<TranscriptionJob | null>(null);
  const [statusText, setStatusText] = useState("");
  const [progress, setProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const polledJob = useJobPoller(internalJob, getJobAction);

  const submitJob = useCallback(
    async ({
      file,
      link,
      mode,
    }: {
      file: File | null;
      link: string | null;
      mode: TranscriptionMode;
    }): Promise<string | null> => {
      setIsSubmitting(true);
      setError(null);
      setProgress(0);

      try {
        let result: {success: boolean; jobId?: string; error?: string};

        if (file) {
          setStatusText("Analyzing file...");
          const fileHash = await calculateFileHash(file);

          setStatusText("Uploading file...");
          const newBlob = await upload(file.name, file, {
            access: "public",
            handleUploadUrl: "/api/client-upload",
            onUploadProgress: (p) => setProgress(p.percentage),
          });

          setStatusText("Creating transcription job...");
          result = await startTranscriptionJob({
            blobUrl: newBlob.url,
            originalFileName: file.name,
            fileSize: file.size,
            fileHash: fileHash,
            transcriptionMode: mode,
          });
        } else if (link) {
          setStatusText("Creating transcription job...");
          result = await startLinkTranscriptionJob({
            linkUrl: link,
            transcriptionMode: mode,
          });
        } else {
          throw new Error("No file or link provided.");
        }

        if (result.success && result.jobId) {
          setIsSubmitting(false);
          setStatusText("Job created successfully!");
          return result.jobId;
        } else {
          throw new Error(result.error || "Server failed to create the job.");
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "An unknown error occurred.";
        setError(msg);
        setIsSubmitting(false);
        return null;
      }
    },
    []
  );

  return {
    job: polledJob,
    statusText,
    progress,
    isSubmitting,
    error,
    submitJob,
    setInitialJob: setInternalJob,
  };
}
