// app/components/ResultsView.tsx
"use client";

import React from "react";
import {
  Waves,
  Settings,
  FileText,
  CheckCircle2,
  ClipboardCopy,
  Download,
} from "lucide-react";
import StyledButton from "./StyledButton";
import DownloadButton from "./DownloadButton";
import JSZip from "jszip";

import {DetailedTranscriptionResult} from "@/actions/transcribeAudioAction";
import {TranscriptionMode} from "./ConfirmationView";

/* -------------------------------------------------- local step list */
interface Step {
  id: string;
  name: string;
  icon: React.ElementType;
}
const STEPS: Step[] = [
  {id: "configure", name: "Configure", icon: Settings},
  {id: "process", name: "Process Audio", icon: Waves},
  {id: "transcribe", name: "Get Transcripts", icon: FileText},
];

const modeLabel = (m: TranscriptionMode) => (m === "turbo" ? "Turbo" : "Chill");

/* -------------------------------------------------- props */
interface Props {
  transcriptionData: DetailedTranscriptionResult;
  mode: TranscriptionMode;
  onRestart: () => void;
}

/* ================================================================== */
export default function ResultsView({
  transcriptionData,
  mode,
  onRestart,
}: Props) {
  const [copied, setCopied] = React.useState(false);
  const [zipping, setZipping] = React.useState(false);

  /* ---------------- copy text with badge --------------------- */
  const copyText = () => {
    navigator.clipboard.writeText(transcriptionData.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /* ---------------- zip all ------------------------------ */
  const zipAll = async () => {
    setZipping(true);
    try {
      const zip = new JSZip();
      zip.file("transcript.txt", transcriptionData.text);
      if (transcriptionData.srtContent)
        zip.file("transcript.srt", transcriptionData.srtContent);
      if (transcriptionData.vttContent)
        zip.file("transcript.vtt", transcriptionData.vttContent);

      const blob = await zip.generateAsync({type: "blob"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "transcripts.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl w-full max-w-md sm:max-w-lg mx-auto text-slate-700">
      {/* ---------------- gray stepper ----------------------- */}
      <GrayProgressStepper steps={STEPS} />

      {/* ---------------- check icon ------------------------ */}
      <div className="flex justify-center my-6">
        <CheckCircle2 size={72} className="text-gray-500" />
      </div>

      <h2 className="text-center text-xl font-semibold mb-6">
        Transcripts generated successfully!
      </h2>

      {/* ---------------- transcript bubble ---------------- */}
      <div className="relative mb-8">
        {/* copy button */}
        <button
          onClick={copyText}
          className="absolute right-3 top-3 p-1.5 rounded-md text-gray-600 hover:bg-slate-200 transition"
          title="Copy text"
        >
          <ClipboardCopy size={18} />
        </button>

        {/* copied badge */}
        <span
          className={`absolute right-0 -top-6 text-xs font-medium text-green-600
                       transition-opacity duration-200
                       ${copied ? "opacity-100" : "opacity-0"}`}
        >
          Text Copied!
        </span>

        <div className="max-h-56 overflow-y-auto p-4 border border-slate-200 rounded-xl bg-slate-50 text-sm leading-relaxed">
          {transcriptionData.text}
        </div>
      </div>

      {/* ---------------- download pills ------------------- */}
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        <DownloadButton
          label="TXT"
          fileContent={transcriptionData.text}
          fileName="transcript.txt"
          mimeType="text/plain"
          variant="secondary"
          size="sm"
        />
        {transcriptionData.vttContent && (
          <DownloadButton
            label="VTT"
            fileContent={transcriptionData.vttContent}
            fileName="transcript.vtt"
            mimeType="text/vtt"
            variant="secondary"
            size="sm"
          />
        )}
        {transcriptionData.srtContent && (
          <DownloadButton
            label="SRT"
            fileContent={transcriptionData.srtContent}
            fileName="transcript.srt"
            mimeType="application/x-subrip"
            variant="secondary"
            size="sm"
          />
        )}
      </div>

      {/* ---------------- zip all --------------------------- */}
      <div className="flex justify-center mb-6">
        <StyledButton
          onClick={zipAll}
          variant="primary"
          isLoading={zipping}
          disabled={zipping}
          className="rounded-full px-6"
        >
          <Download size={18} className="mr-2" />
          {zipping ? "Zipping…" : "Download All (.zip)"}
        </StyledButton>
      </div>

      {/* ---------------- new transcription ---------------- */}
      <StyledButton
        onClick={onRestart}
        variant="secondary"
        size="lg"
        className="w-full rounded-full mb-6"
      >
        New Transcription
      </StyledButton>

      {/* ---------------- footer line ---------------------- */}
      <p className="text-xs text-slate-500 text-center">
        Transcription completed using <strong>{modeLabel(mode)}</strong> mode.
      </p>
    </div>
  );
}

/* ================================================================== */
/*                 GRAY  PROGRESS  STEPPER                             */
/* ================================================================== */
function GrayProgressStepper({steps}: {steps: Step[]}) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol role="list" className="relative flex items-start justify-between">
        <div
          className="absolute top-3.5 left-4 right-4 h-0.5 bg-gray-200"
          aria-hidden="true"
        />
        {steps.map((step) => (
          <li
            key={step.id}
            className="relative flex flex-col items-center w-1/3"
          >
            <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-400 text-white">
              <step.icon className="h-5 w-5" />
            </div>
            <p className="text-xs text-center mt-2 w-20 truncate text-gray-500">
              {step.name}
            </p>
          </li>
        ))}
      </ol>
    </nav>
  );
}
