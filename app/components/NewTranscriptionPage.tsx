// app/components/NewTranscriptionPage.tsx
"use client";

import React, {useState, useCallback, useEffect} from "react";
import {useRouter} from "next/navigation";
import {submitMediaJob} from "@/actions/jobActions";
import {calculateFileHash} from "@/lib/hash-utils";
import {
  type SelectedInputType,
  APP_STEPS,
  type StageDisplayData,
} from "@/types/app";
import InputSelectionView from "@/components/InputSelectionView";
import ConfirmationView from "@/components/ConfirmationView";
import ProcessingView from "@/components/ProcessingView";
import {StepperProvider, useStepper} from "../contexts/StepperContext";
import {usePage} from "../contexts/PageContext";

enum ViewState {
  SelectingInput,
  ConfirmingInput,
  Submitting,
  Error,
}

function NewTranscriptionContent() {
  const {setStep, step} = useStepper();
  const router = useRouter();
  const [view, setView] = useState<ViewState>(ViewState.SelectingInput);
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [inputType, setInputType] = useState<SelectedInputType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeStage, setActiveStage] = useState<StageDisplayData | null>(null);
  const [statusText, setStatusText] = useState("");
  const {setPageTitle} = usePage();

  useEffect(() => {
    setPageTitle("New Transcription");
  }, [setPageTitle]);

  const onFileSelected = (f: File) => {
    setFile(f);
    setLink(null);
    setInputType("audio");
    setView(ViewState.ConfirmingInput);
    setStep("configure");
  };
  const onLinkSubmitted = (l: string) => {
    setLink(l);
    setFile(null);
    setInputType("link");
    setView(ViewState.ConfirmingInput);
    setStep("configure");
  };
  const onCancel = useCallback(() => {
    setView(ViewState.SelectingInput);
    setStep("configure");
    setError(null);
  }, [setStep]);

  // in NewTranscriptionContent component...

  const onConfirm = async () => {
    setIsSubmitting(true);
    setView(ViewState.Submitting);
    setStep("process");
    setError(null);

    try {
      // We declare 'result' here, but will assign it inside the if/else blocks.
      let result: {success: boolean; tempJobId?: string; error?: string};

      if (file) {
        // --- This is the FILE upload path ---
        setStatusText("Preparing secure upload...");
        setActiveStage({
          name: "upload",
          label: "Preparing Upload...",
          progress: 0,
          isActive: true,
        });

        const presignedUrlResponse = await fetch("/api/presigned-url", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({filename: file.name, contentType: file.type}),
        });
        if (!presignedUrlResponse.ok) {
          const errorBody = await presignedUrlResponse.json();
          throw new Error(`Could not prepare upload: ${errorBody.error}`);
        }

        // `publicUrl` is correctly scoped and defined here.
        const {url: presignedUrl, publicUrl} =
          await presignedUrlResponse.json();

        setStatusText("Uploading your file...");
        setActiveStage((prev) => ({
          ...prev!,
          label: "Uploading File...",
          progress: 0.1,
          isIndeterminate: true,
        }));

        const uploadResponse = await fetch(presignedUrl, {
          method: "PUT",
          body: file,
          headers: {"Content-Type": file.type},
        });
        if (!uploadResponse.ok) throw new Error("File upload failed.");

        setActiveStage((prev) => ({
          ...prev!,
          label: "Upload Complete",
          progress: 1,
        }));
        setStatusText("Creating your job...");

        const hash = await calculateFileHash(file);

        // The server action is called with the `publicUrl` from this scope.
        result = await submitMediaJob({
          type: "file",
          blobUrl: publicUrl,
          originalFileName: file.name,
          fileHash: hash,
          fileSize: file.size,
        });
      } else if (link) {
        // --- This is the LINK submission path ---
        setStatusText("Submitting your link...");
        setActiveStage({
          name: "create",
          label: "Submitting Job...",
          progress: 0,
          isActive: true,
          isIndeterminate: true,
        });

        // The server action is called with the `link` from this scope.
        result = await submitMediaJob({
          type: "link",
          linkUrl: link,
        });
      } else {
        throw new Error("No input selected");
      }

      // This final part is now universal and correct.
      if (result.success && result.tempJobId) {
        router.push(`/job/processing/${result.tempJobId}`);
      } else {
        throw new Error(result.error || "Failed to start job");
      }
    } catch (e: any) {
      setError(e.message);
      setView(ViewState.Error);
    }
  };

  if (error)
    return (
      <div className="bg-[var(--card-bg)] p-8 rounded-xl shadow-xl w-full max-w-xl mx-auto text-center">
        <h2 className="text-xl font-bold text-red-500">Error</h2>
        <p className="my-4">{error}</p>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded font-semibold"
        >
          Try Again
        </button>
      </div>
    );

  switch (view) {
    case ViewState.SelectingInput:
      return (
        <InputSelectionView
          onFileSelected={onFileSelected}
          onLinkSubmitted={onLinkSubmitted}
        />
      );
    case ViewState.ConfirmingInput:
      return (
        <ConfirmationView
          file={file}
          link={link}
          inputType={inputType}
          onConfirm={onConfirm}
          onCancel={onCancel}
          isSubmitting={isSubmitting}
        />
      );
    case ViewState.Submitting:
      return (
        <ProcessingView
          stage={activeStage}
          currentOverallStatusMessage={statusText}
          appSteps={APP_STEPS}
          currentAppStepId={step}
        />
      );
    default:
      return null;
  }
}

export default function NewTranscriptionPage() {
  return (
    <StepperProvider>
      <NewTranscriptionContent />
    </StepperProvider>
  );
}
