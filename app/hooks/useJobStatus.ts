// app/hooks/useJobStatus.ts
"use client";

import {useState, useEffect, useCallback} from "react";
import type {TranscriptionJob} from "@prisma/client";
import {getJobAction} from "@/actions/jobActions";

export function useJobStatus(initialJob: TranscriptionJob) {
  const [job, setJob] = useState(initialJob);

  const shouldPoll = job.status === "PENDING" || job.status === "PROCESSING";

  const poll = useCallback(async () => {
    const updatedJob = await getJobAction(job.id);
    if (updatedJob) {
      setJob(updatedJob);
    }
  }, [job.id]);

  useEffect(() => {
    if (!shouldPoll) return;

    const intervalId = setInterval(poll, 3000); // Simple 3-second poll
    return () => clearInterval(intervalId);
  }, [shouldPoll, poll]);

  return job;
}
