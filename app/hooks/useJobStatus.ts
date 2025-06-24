// app/hooks/useJobStatus.ts
"use client";

import {useState, useEffect, useCallback} from "react";
import type {TranscriptionJob} from "@prisma/client";

export function useJobStatus(
  initialJob: TranscriptionJob,
  getJobAction: (jobId: string) => Promise<TranscriptionJob | null>
) {
  const [job, setJob] = useState<TranscriptionJob>(initialJob);

  const [pollInterval, setPollInterval] = useState<number | null>(
    job.status === "PENDING" || job.status === "PROCESSING" ? 2000 : null
  );

  const poll = useCallback(async () => {
    if (!job.id) return;
    try {
      const updatedJob = await getJobAction(job.id);
      if (updatedJob) {
        setJob(updatedJob);
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
  }, [job.id, getJobAction]);

  useEffect(() => {
    if (pollInterval === null) return;
    const intervalId = setInterval(poll, pollInterval);
    return () => clearInterval(intervalId);
  }, [pollInterval, poll]);

  return job;
}
