// app/hooks/useJobStatus.ts
"use client";

import {useState, useEffect, useCallback} from "react";
import type {TranscriptionJob} from "@prisma/client";
// We no longer import the server action directly in this file.

// --- THIS IS THE DEFINITIVE FIX ---
// The hook now accepts the data-fetching function as a parameter.
export function useJobStatus(
  initialJob: TranscriptionJob,
  getJob: (jobId: string) => Promise<TranscriptionJob | null>
) {
  const [job, setJob] = useState(initialJob);

  const shouldPoll = job.status === "PENDING" || job.status === "PROCESSING";

  const poll = useCallback(async () => {
    // It now calls the `getJob` function that was passed in.
    const updatedJob = await getJob(job.id);
    if (updatedJob) {
      setJob(updatedJob);
    }
  }, [job.id, getJob]);

  useEffect(() => {
    if (!shouldPoll) return;

    const intervalId = setInterval(poll, 3000);
    return () => clearInterval(intervalId);
  }, [shouldPoll, poll]);

  return job;
}
