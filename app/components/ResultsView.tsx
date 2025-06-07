// app/components/ResultsView.tsx
"use client";

import React, {useState, useRef, useEffect} from "react";
import {
  Waves,
  Settings,
  FileText,
  CheckCircle2,
  ClipboardCopy,
  Download,
  Brain,
  Loader2,
  ListChecks,
  HelpCircle,
  Send,
  ClipboardCheck,
  AlertCircle, // Added for Action Items
} from "lucide-react";
import StyledButton from "./StyledButton";
import DownloadButton from "./DownloadButton";
import JSZip from "jszip";

import {DetailedTranscriptionResult} from "@/actions/transcribeAudioAction";
import {TranscriptionMode} from "./ConfirmationView";
import {
  AIInteractionTaskType,
  AIInteractionParams,
} from "@/actions/interactWithTranscriptAction";

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
const AI_INTERACTION_API_ENDPOINT = "/api/ai_interaction";
interface Props {
  transcriptionData: DetailedTranscriptionResult;
  mode: TranscriptionMode;
  onRestart: () => void;
}

export default function ResultsView({
  transcriptionData,
  mode,
  onRestart,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [zipping, setZipping] = useState(false);

  const [isAiTaskLoading, setIsAiTaskLoading] = useState(false);
  const [currentAiTask, setCurrentAiTask] =
    useState<AIInteractionTaskType | null>(null);
  const [aiResultText, setAiResultText] = useState<string>("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [customQuestion, setCustomQuestion] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const [showTruncationNote, setShowTruncationNote] = useState(false);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const copyText = () => {
    navigator.clipboard.writeText(transcriptionData.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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

  const handleGenericAiStreamTask = async (
    taskType: AIInteractionTaskType,
    questionForTask?: string
  ) => {
    if (!transcriptionData.text) return;
    if (
      taskType === "custom_question" &&
      (!questionForTask || questionForTask.trim() === "")
    ) {
      setAiError("Please enter a question.");
      setAiResultText("");
      setCurrentAiTask(null);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsAiTaskLoading(true);
    setCurrentAiTask(taskType);
    setAiResultText("");
    setAiError(null);
    setShowTruncationNote(false); // Reset for new task

    const body: AIInteractionParams = {
      transcriptText: transcriptionData.text,
      taskType: taskType,
      customPrompt:
        taskType === "custom_question" ? questionForTask : undefined,
    };

    try {
      const response = await fetch(AI_INTERACTION_API_ENDPOINT, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      });

      // Check for custom header AFTER response, regardless of ok status initially
      if (response.headers.get("X-Content-Truncated") === "true") {
        setShowTruncationNote(true);
        console.log("[ResultsView] Received X-Content-Truncated header.");
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          throw new Error(
            `API Error: ${response.status} ${response.statusText}`
          );
        }
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }
      if (!response.body) throw new Error("Response body is null.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      async function processStream() {
        while (true) {
          // Check for abort signal inside the loop if reads are long
          if (abortControllerRef.current?.signal.aborted) {
            console.log("Stream processing loop aborted.");
            setAiResultText(
              (prev) => prev + "\n[Stream aborted by new request]"
            ); // Optional feedback
            break;
          }
          try {
            const {done, value} = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, {stream: true});
            setAiResultText((prev) => prev + chunk);
          } catch (streamError: unknown) {
            console.error("Error reading stream:", streamError);
            const err = streamError as {name?: string; message?: string};
            if (err.name !== "AbortError") {
              // AbortError is expected if aborted
              setAiError(
                "Error reading stream: " +
                  (err.message || "Unknown stream error")
              );
            } else {
              console.log("Stream reading aborted by client/controller.");
            }
            break;
          }
        }
      }
      await processStream();
      if (
        taskType === "custom_question" &&
        !aiError &&
        !abortControllerRef.current?.signal.aborted
      ) {
        setCustomQuestion("");
      }
    } catch (error: unknown) {
      const err = error as {name?: string; message?: string};
      if (err.name !== "AbortError") {
        setAiError(err.message || `Failed to process ${taskType} task.`);
      } else {
        if (
          abortControllerRef.current === null ||
          abortControllerRef.current.signal.aborted
        ) {
          setAiError(null);
          setAiResultText(
            ""
          ); /* setShowTruncationNote(false); Don't hide note if already shown for this attempt */
        }
      }
    } finally {
      setIsAiTaskLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleQuestionSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    handleGenericAiStreamTask("custom_question", customQuestion);
  };

  let resultBoxStaticTitle = "";
  if (
    currentAiTask &&
    (!isAiTaskLoading || (isAiTaskLoading && aiResultText))
  ) {
    if (currentAiTask === "summarize")
      resultBoxStaticTitle = "AI Generated Summary:";
    else if (currentAiTask === "extract_key_points")
      resultBoxStaticTitle = "AI Extracted Key Points:";
    else if (currentAiTask === "custom_question")
      resultBoxStaticTitle = "AI Answer:";
    else if (currentAiTask === "extract_action_items")
      resultBoxStaticTitle = "AI Extracted Action Items:";
  }

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl w-full max-w-lg md:max-w-xl mx-auto text-slate-700">
      {/* ... Header, Stepper, Main Title, Transcript Display, Download Buttons ... */}
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          QuickScribe
        </h1>
        <p className="text-sm text-slate-500 mt-1">Powered by Groq</p>
      </div>
      <GrayProgressStepper steps={STEPS} />
      <div className="flex justify-center my-6">
        <CheckCircle2 size={72} className="text-gray-500" />
      </div>
      <h2 className="text-center text-xl font-semibold mb-6">
        Transcripts generated successfully!
      </h2>
      <div className="relative mb-8">
        <button
          onClick={copyText}
          className="absolute right-3 top-3 p-1.5 rounded-md text-gray-600 bg-slate-200 hover:bg-slate-300 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 transition"
          title="Copy text"
        >
          <ClipboardCopy size={18} />
        </button>
        <span
          className={`absolute right-0 -top-6 text-xs font-medium text-green-600 transition-opacity duration-200 ${
            copied ? "opacity-100" : "opacity-0"
          }`}
        >
          Text Copied!
        </span>
        <div className="max-h-56 overflow-y-auto p-4 border border-slate-200 rounded-xl bg-slate-50 text-sm leading-relaxed">
          {transcriptionData.text}
        </div>
      </div>
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

      {/* --- AI Interaction Section --- */}
      <div className="my-8 py-6 border-t border-b border-slate-200 space-y-6">
        {/* ... AI Quick Tools Buttons (Summarize, Key Points, Action Items) ... */}
        <div>
          <h3 className="text-lg font-semibold text-slate-800 mb-3 text-center">
            AI Quick Tools (Streaming)
          </h3>
          <div className="flex flex-col sm:flex-row flex-wrap justify-center items-center gap-3">
            <StyledButton
              onClick={() => handleGenericAiStreamTask("summarize")}
              variant="secondary"
              isLoading={isAiTaskLoading && currentAiTask === "summarize"}
              disabled={isAiTaskLoading || !transcriptionData.text}
              className="group w-full sm:w-auto"
            >
              {isAiTaskLoading && currentAiTask === "summarize" ? (
                <Loader2 size={18} className="mr-2 animate-spin" />
              ) : (
                <Brain size={18} className="mr-2 group-hover:animate-pulse" />
              )}
              {isAiTaskLoading && currentAiTask === "summarize"
                ? "Summarizing..."
                : "Summarize"}
            </StyledButton>
            <StyledButton
              onClick={() => handleGenericAiStreamTask("extract_key_points")}
              variant="secondary"
              isLoading={
                isAiTaskLoading && currentAiTask === "extract_key_points"
              }
              disabled={isAiTaskLoading || !transcriptionData.text}
              className="group w-full sm:w-auto"
            >
              {isAiTaskLoading && currentAiTask === "extract_key_points" ? (
                <Loader2 size={18} className="mr-2 animate-spin" />
              ) : (
                <ListChecks
                  size={18}
                  className="mr-2 group-hover:scale-110 transition-transform"
                />
              )}
              {isAiTaskLoading && currentAiTask === "extract_key_points"
                ? "Extracting..."
                : "Key Points"}
            </StyledButton>
            <StyledButton
              onClick={() => handleGenericAiStreamTask("extract_action_items")}
              variant="secondary"
              isLoading={
                isAiTaskLoading && currentAiTask === "extract_action_items"
              }
              disabled={isAiTaskLoading || !transcriptionData.text}
              className="group w-full sm:w-auto"
            >
              {isAiTaskLoading && currentAiTask === "extract_action_items" ? (
                <Loader2 size={18} className="mr-2 animate-spin" />
              ) : (
                <ClipboardCheck
                  size={18}
                  className="mr-2 group-hover:rotate-[-3deg] transition-transform"
                />
              )}
              {isAiTaskLoading && currentAiTask === "extract_action_items"
                ? "Extracting..."
                : "Action Items"}
            </StyledButton>
          </div>
        </div>
        {/* ... Q&A Form ... */}
        <div>
          <h3 className="text-lg font-semibold text-slate-800 mb-3 text-center">
            <HelpCircle
              size={20}
              className="inline mr-1 mb-0.5 text-slate-400"
            />{" "}
            Ask a Question (Streaming)
          </h3>
          <form onSubmit={handleQuestionSubmitForm} className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                placeholder="Ask anything about the transcript..."
                className="flex-grow px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors text-sm"
                disabled={isAiTaskLoading || !transcriptionData.text}
              />
              <StyledButton
                type="submit"
                variant="primary"
                isLoading={
                  isAiTaskLoading && currentAiTask === "custom_question"
                }
                disabled={
                  isAiTaskLoading ||
                  !transcriptionData.text ||
                  !customQuestion.trim()
                }
                className="flex-shrink-0 bg-sky-600 hover:bg-sky-700 focus-visible:ring-sky-500"
                size="icon"
              >
                {!(isAiTaskLoading && currentAiTask === "custom_question") && (
                  <Send size={18} />
                )}
              </StyledButton>
            </div>
          </form>
        </div>

        {/* Truncation Notification */}
        {showTruncationNote && !isAiTaskLoading && (
          <div className="mt-4 p-3 border border-amber-300 rounded-lg bg-amber-100 text-amber-700 text-xs flex items-center space-x-2">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>
              Note: The AI processed a shortened version of the transcript due
              to its length. Results may not cover the entire content.
            </span>
          </div>
        )}

        {/* Display AI Result or Error */}
        {(currentAiTask ||
          aiResultText ||
          (aiError && !isAiTaskLoading) ||
          (showTruncationNote && !isAiTaskLoading)) &&
          // If there's only the truncation note and no actual result/error yet, ensure box isn't awkwardly empty
          // by adding a condition to not render if it's ONLY the truncation note and task is not loading.
          // Or ensure the box has min-height. For now, let's adjust the outer condition slightly.
          // Show if (loading OR result OR error) OR (truncationNote AND no other main content yet but task was run)
          ((isAiTaskLoading && currentAiTask) ||
            aiResultText ||
            (aiError && !isAiTaskLoading) ||
            (showTruncationNote &&
              currentAiTask &&
              !aiResultText &&
              !aiError)) && (
            <div
              className={`mt-2 p-4 border rounded-lg text-sm ${
                aiError && !isAiTaskLoading
                  ? "border-red-300 bg-red-50 text-red-700"
                  : "border-sky-200 bg-sky-50 text-slate-700"
              }`}
            >
              {aiError && !isAiTaskLoading ? (
                <p className="break-words">
                  <strong>Error:</strong> {aiError}
                </p>
              ) : (
                <>
                  {resultBoxStaticTitle && (
                    <h4 className="font-semibold mb-2 text-sky-700">
                      {resultBoxStaticTitle}
                    </h4>
                  )}
                  {isAiTaskLoading &&
                    !aiResultText &&
                    currentAiTask &&
                    currentAiTask !== "custom_question" && (
                      <div className="flex items-center justify-center py-1">
                        <Loader2
                          size={18}
                          className="animate-spin text-sky-600 mr-2"
                        />
                        Processing AI Request...
                      </div>
                    )}
                  {aiResultText && (
                    <div
                      className={`whitespace-pre-wrap break-words ${
                        isAiTaskLoading &&
                        !aiResultText &&
                        currentAiTask !== "custom_question"
                          ? ""
                          : "mt-1"
                      }`}
                    >
                      {aiResultText}
                      {isAiTaskLoading && aiResultText && (
                        <span className="inline-block animate-ping w-1.5 h-1.5 bg-sky-500 rounded-full ml-1"></span>
                      )}
                    </div>
                  )}
                  {!isAiTaskLoading && aiResultText && !aiError && (
                    <div className="mt-3 flex justify-end">
                      <StyledButton
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          navigator.clipboard.writeText(aiResultText)
                        }
                        className="text-sky-600 hover:bg-sky-100"
                      >
                        <ClipboardCopy size={16} className="mr-1.5" /> Copy
                        Result
                      </StyledButton>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
      </div>
      {/* ... Footer Buttons ... */}
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
      <StyledButton
        onClick={onRestart}
        variant="secondary"
        size="lg"
        className="w-full rounded-full mb-6"
      >
        New Transcription
      </StyledButton>
      <p className="text-xs text-slate-500 text-center">
        Transcription completed using <strong>{modeLabel(mode)}</strong> mode.
      </p>
    </div>
  );
}

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
