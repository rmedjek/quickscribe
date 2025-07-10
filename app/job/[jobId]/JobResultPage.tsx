// app/job/[jobId]/JobResultPage.tsx
"use client";
import {useEffect} from "react";
import type {TranscriptionJob} from "@prisma/client";
import {usePage} from "@/app/contexts/PageContext";
import ResultsView from "@/components/ResultsView";
import type {TranscriptionMode} from "@/components/ConfirmationView";
import {useRouter} from "next/navigation";

export default function JobResultPage({job}: {job: TranscriptionJob}) {
  const {setPageTitle} = usePage();
  const router = useRouter();

  useEffect(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    setPageTitle(job.displayTitle || job.sourceFileName, job.id);
    return () => setPageTitle("", null);
  }, [job, setPageTitle]);

  const transcriptionData = {
    text: job.transcriptText || "",
    srtContent: job.transcriptSrt || "",
    vttContent: job.transcriptVtt || "",
  };

  return (
    <ResultsView
      transcriptionData={transcriptionData}
      transcriptLanguage={job.language || "en"}
      mode={job.engineUsed as TranscriptionMode}
      onRestart={() => router.push("/")}
    />
  );
}
