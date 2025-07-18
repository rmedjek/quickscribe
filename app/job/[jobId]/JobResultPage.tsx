// app/job/[jobId]/JobResultPage.tsx
"use client";
import {useEffect} from "react";
import type {TranscriptionJob} from "@prisma/client";
import {usePage} from "@/app/contexts/PageContext";
import ResultsView from "@/components/ResultsView";
import {useRouter} from "next/navigation";

// The props for this component remain the same: it receives the full job object.
export default function JobResultPage({job}: {job: TranscriptionJob}) {
  const {setPageTitle} = usePage();
  const router = useRouter();

  useEffect(() => {
    setPageTitle(job.displayTitle || job.sourceFileName, job.id);
    return () => setPageTitle("", null);
  }, [job, setPageTitle]);

  // --- THIS IS THE FIX ---
  // We no longer need to create a separate `transcriptionData` object
  // or pass down individual props like `mode` and `language`.

  return (
    // We simply pass the entire `job` object directly to ResultsView.
    <ResultsView job={job} onRestart={() => router.push("/")} />
  );
  // --- END FIX ---
}
