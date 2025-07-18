// app/components/ResultsView.tsx
"use client";

import React, {useState, useMemo} from "react";
import {
  CheckCircle2,
  ClipboardCopy,
  Download,
  Brain,
  ListChecks,
  HelpCircle,
  Send,
  User,
} from "lucide-react";
import StyledButton from "./StyledButton";
import DownloadButton from "./DownloadButton";
import {APP_STEPS} from "@/types/app";
import ProgressStepper from "./ProgressStepper";
import type {TranscriptionJob} from "@prisma/client";
import {askQuestionAboutTranscript} from "@/actions/aiActions";
import {InsightCard} from "./InsightCard";

interface Props {
  job: TranscriptionJob & {ai_results: any | null}; // Ensure ai_results is typed
  onRestart: () => void;
}

export default function ResultsView({job, onRestart}: Props) {
  const [copied, setCopied] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  const aiResults = useMemo(() => {
    if (job.ai_results && typeof job.ai_results === "object") {
      return job.ai_results;
    }
    return null;
  }, [job.ai_results]);

  const copyText = (textToCopy: string | null) => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !job.transcriptText || !job.external_id) {
      setQaError("Cannot ask question without a transcript ID.");
      return;
    }
    setIsAnswering(true);
    setAnswer(null);
    setQaError(null);
    const result = await askQuestionAboutTranscript(job.external_id, question);
    if (result.success) {
      setAnswer(result.answer!);
    } else {
      setQaError(result.error!);
    }
    setIsAnswering(false);
    setQuestion("");
  };

  const zipAll = async () => {
    setZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      if (job.transcriptText) zip.file("transcript.txt", job.transcriptText);
      if (job.transcriptSrt) zip.file("transcript.srt", job.transcriptSrt);
      if (job.transcriptVtt) zip.file("transcript.vtt", job.transcriptVtt);
      if (aiResults) {
        zip.file("ai_insights.json", JSON.stringify(aiResults, null, 2));
      }
      const blob = await zip.generateAsync({type: "blob"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "quickscribe-results.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Error creating zip file:", err);
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="bg-[var(--card-bg)] text-[var(--text-primary)] p-6 sm:p-8 rounded-xl shadow-xl w-full max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <ProgressStepper steps={APP_STEPS} variant="completed" />
        <div className="flex justify-center my-6">
          <CheckCircle2 size={64} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-bold">
          Transcript Generated Successfully!
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Powered by AssemblyAI
        </p>
      </div>

      <div className="relative mb-8">
        <button
          onClick={() => copyText(job.transcriptText || "")}
          className="absolute right-3 top-3 p-1.5 rounded-md text-[var(--text-secondary)] bg-[var(--card-bg)] hover:bg-[var(--card-primary-bg)] dark:hover:bg-slate-600 transition-colors"
          title="Copy text"
        >
          <ClipboardCopy size={18} />
        </button>
        <span
          className={`absolute right-0 -top-6 text-xs font-medium text-green-600 dark:text-green-400 transition-opacity duration-200 ${
            copied ? "opacity-100" : "opacity-0"
          }`}
        >
          Text Copied!
        </span>
        <div className="max-h-56 overflow-y-auto p-4 rounded-xl bg-[var(--card-secondary-bg)]">
          {aiResults?.utterances?.length > 0 ? (
            aiResults.utterances.map((utt: any) => (
              <div key={utt.start} className="mb-2">
                <p className="font-bold text-sky-500">
                  <User size={14} className="inline-block mr-2" /> Speaker{" "}
                  {utt.speaker}
                </p>
                <p className="ml-7 text-sm">{utt.text}</p>
              </div>
            ))
          ) : (
            <p className="whitespace-pre-wrap text-sm">{job.transcriptText}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3 mb-6">
        <DownloadButton
          label="TXT"
          fileContent={job.transcriptText || ""}
          fileName="transcript.txt"
          mimeType="text/plain"
          variant="secondary"
          size="sm"
        />
        <DownloadButton
          label="VTT"
          fileContent={job.transcriptVtt || ""}
          fileName="transcript.vtt"
          mimeType="text/vtt"
          variant="secondary"
          size="sm"
        />
        <DownloadButton
          label="SRT"
          fileContent={job.transcriptSrt || ""}
          fileName="transcript.srt"
          mimeType="application/x-subrip"
          variant="secondary"
          size="sm"
        />
      </div>

      <div className="flex justify-center mb-6">
        <StyledButton
          onClick={zipAll}
          variant="primary"
          isLoading={zipping}
          disabled={zipping}
          className="!bg-sky-600 hover:!bg-sky-700 !text-white rounded-full px-6"
        >
          <Download size={18} className="mr-2" />
          {zipping ? "Zipping…" : "Download All (.zip)"}
        </StyledButton>
      </div>

      <div className="my-8 py-6 border-t border-b border-[var(--border-color)] space-y-6">
        <h3 className="text-lg font-semibold text-center">
          AI-Powered Insights
        </h3>

        {aiResults?.summary && (
          <InsightCard title="Summary" icon={Brain}>
            <p className="text-sm whitespace-pre-wrap">{aiResults.summary}</p>
          </InsightCard>
        )}

        {aiResults?.auto_highlights?.length > 0 && (
          <InsightCard title="Key Highlights" icon={ListChecks}>
            <ul className="space-y-2">
              {aiResults.auto_highlights.map((highlight: any) => (
                <li key={highlight.text} className="text-sm flex items-start">
                  <span className="mr-2 mt-1 text-sky-500">•</span>
                  <span>{highlight.text}</span>
                </li>
              ))}
            </ul>
          </InsightCard>
        )}

        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <HelpCircle size={20} /> Ask a Question
          </h3>
          <form onSubmit={handleQuestionSubmit} className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask anything about the transcript..."
                className="flex-grow px-3 py-2 bg-[var(--card-secondary-bg)] border border-[var(--border-color)] rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                disabled={isAnswering}
              />
              <StyledButton
                type="submit"
                variant="primary"
                isLoading={isAnswering}
                disabled={!question.trim() || isAnswering}
                size="icon"
              >
                {!isAnswering && <Send size={18} />}
              </StyledButton>
            </div>
          </form>
          {qaError && <p className="text-sm text-red-500 mt-2">{qaError}</p>}
          {answer && (
            <div className="mt-4 p-4 bg-[var(--card-secondary-bg)] rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{answer}</p>
            </div>
          )}
        </div>
      </div>

      <StyledButton
        onClick={onRestart}
        variant="secondary"
        size="lg"
        className="w-full rounded-full mt-8"
      >
        New Transcription
      </StyledButton>
    </div>
  );
}
