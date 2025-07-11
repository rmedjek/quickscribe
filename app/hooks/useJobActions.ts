// app/hooks/useJobActions.ts
"use client";

import {useRouter} from "next/navigation";
import {deleteJobAction, renameJobAction} from "@/actions/jobActions";
import type {TranscriptionJob} from "@prisma/client";
import type {Dispatch, SetStateAction} from "react";

export function useJobActions() {
  const router = useRouter();

  const handleRename = async (jobId: string, newTitle: string) => {
    if (!jobId || !newTitle.trim()) return;
    await renameJobAction(jobId, newTitle);
    router.refresh();
  };

  const handleDelete = async (
    jobToDelete: TranscriptionJob,
    activeJobId: string | null,
    setJobs: Dispatch<SetStateAction<TranscriptionJob[]>>
  ) => {
    setJobs((currentJobs) =>
      currentJobs.filter((job) => job.id !== jobToDelete.id)
    );

    await deleteJobAction(jobToDelete.id);

    if (jobToDelete.id === activeJobId) {
      router.push("/");
    }
  };

  return {handleRename, handleDelete};
}
