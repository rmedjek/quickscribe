// app/new/page.tsx
"use client";

import {useSearchParams, useRouter} from "next/navigation";
import {Suspense, useState, useEffect} from "react";
import ConfirmationView, {
  TranscriptionMode,
} from "@/components/ConfirmationView";
import {useJobSubmission} from "@/hooks/useJobSubmission";
import PageLayout from "@/components/PageLayout";

function NewJobPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {isSubmitting, error, submitJob} = useJobSubmission();

  const [fileInput, setFileInput] = useState<File | null>(null);
  const [linkInput, setLinkInput] = useState<string | null>(null);

  useEffect(() => {
    const link = searchParams.get("link");
    const fileUrl = searchParams.get("fileUrl");
    const fileName = searchParams.get("fileName");
    const fileType = searchParams.get("fileType");

    if (link) {
      setLinkInput(link);
    } else if (fileUrl && fileName && fileType) {
      fetch(fileUrl)
        .then((res) => res.blob())
        .then((blob) => {
          setFileInput(new File([blob], fileName, {type: fileType}));
          URL.revokeObjectURL(fileUrl);
        });
    }
  }, [searchParams]);

  const handleConfirmAndSubmit = (mode: TranscriptionMode) => {
    submitJob({file: fileInput, link: linkInput, mode}).then((jobId) => {
      if (jobId) {
        router.push(`/dashboard/job/${jobId}`);
      }
    });
  };

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (!fileInput && !linkInput) {
    return <div>Loading input details...</div>;
  }

  return (
    <ConfirmationView
      file={fileInput}
      link={linkInput}
      inputType={fileInput ? "audio" : "link"}
      onConfirm={(path, mode) => handleConfirmAndSubmit(mode)}
      onCancel={() => router.push("/")}
      isSubmitting={isSubmitting}
    />
  );
}

export default function NewJobPage() {
  return (
    <PageLayout>
      <Suspense fallback={<div>Loading...</div>}>
        <NewJobPageContent />
      </Suspense>
    </PageLayout>
  );
}
