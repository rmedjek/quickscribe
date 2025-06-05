// app/components/ResultsView.tsx
"use client";

import React, {useState, useRef, useEffect} from "react"; // Added useRef, useEffect
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
} from "lucide-react";
import StyledButton from "./StyledButton";
import DownloadButton from "./DownloadButton";
import JSZip from "jszip";

import {DetailedTranscriptionResult} from "@/actions/transcribeAudioAction";
import {TranscriptionMode} from "./ConfirmationView";
import {
  AIInteractionTaskType, // Only need the type now
  AIInteractionParams, // And the params interface for the body
} from "@/actions/interactWithTranscriptAction"; // Path to your action

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

const AI_INTERACTION_API_ENDPOINT = "/api/ai_interaction"; // API route wrapper

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

  // Unified AI State for streaming
  const [isAiTaskLoading, setIsAiTaskLoading] = useState(false);
  const [currentAiTask, setCurrentAiTask] =
    useState<AIInteractionTaskType | null>(null);
  const [aiResultText, setAiResultText] = useState<string>(""); // Holds the streamed text
  const [aiError, setAiError] = useState<string | null>(null);
  const [customQuestion, setCustomQuestion] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup inflight request if component unmounts
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

  // Unified handler for all AI tasks (now all streaming)
  const handleGenericAiStreamTask = async (
    taskType: AIInteractionTaskType,
    questionForTask?: string // Specifically for custom_question
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

    setIsAiTaskLoading(true);
    setCurrentAiTask(taskType);
    setAiResultText(""); // Clear previous/current result
    setAiError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); // Abort previous request
    }
    abortControllerRef.current = new AbortController();

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

      if (!response.body) {
        throw new Error("Response body is null.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // eslint-disable-next-line no-inner-declarations
      async function processStream() {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          try {
            const {done, value} = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, {stream: true});
            setAiResultText((prev) => prev + chunk);
          } catch (streamError: unknown) {
            console.error("Error reading stream:", streamError);
            if (
              typeof streamError === "object" &&
              streamError !== null &&
              "name" in streamError &&
              (streamError as {name?: string}).name !== "AbortError"
            ) {
              setAiError(
                "Error reading stream: " +
                  ((streamError as {message?: string}).message || "")
              );
            } else if (
              typeof streamError === "object" &&
              streamError !== null &&
              "name" in streamError &&
              (streamError as {name?: string}).name === "AbortError"
            ) {
              console.log("Stream reading aborted by client.");
            }
            break;
          }
        }
      }

      await processStream(); // Wait for the stream processing to complete or error out

      if (taskType === "custom_question" && !aiError) {
        // Only clear question if it was Q&A and no error during stream
        setCustomQuestion("");
      }
    } catch (error: unknown) {
      console.error(`Fetch error for AI task ${taskType}:`, error);
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as {name?: string}).name !== "AbortError"
      ) {
        setAiError(
          (error as {message?: string}).message ||
            `Failed to process ${taskType} task.`
        );
      } else if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as {name?: string}).name === "AbortError"
      ) {
        setAiError(null); // Clear error if it was an intentional abort
        setAiResultText(""); // Clear partial results on abort
      } else {
        setAiError(`Failed to process ${taskType} task.`);
      }
    } finally {
      setIsAiTaskLoading(false);
      // setCurrentAiTask(null); // Optional: clear current task after completion or keep it
      abortControllerRef.current = null;
    }
  };

  const handleQuestionSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    handleGenericAiStreamTask("custom_question", customQuestion);
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl w-full max-w-lg md:max-w-xl mx-auto text-slate-700">
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
        <div>
          <h3 className="text-lg font-semibold text-slate-800 mb-3 text-center">
            AI Quick Tools (Streaming)
          </h3>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
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
                : "Generate Summary"}
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
                : "Extract Key Points"}
            </StyledButton>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-800 mb-3 text-center">
            <HelpCircle
              size={20}
              className="inline mr-1 mb-0.5 text-slate-400"
            />
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
                size="md"
              >
                {isAiTaskLoading && currentAiTask === "custom_question" ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </StyledButton>
            </div>
          </form>
        </div>

        {/* Display AI Result or Error (Unified Display Area) */}
        {/* Show this area if loading, or if there's a result, or if there's an error */}
        {(isAiTaskLoading || aiResultText || aiError) && (
          <div
            className={`mt-6 p-4 border rounded-lg text-sm 
            ${
              aiError
                ? "border-red-300 bg-red-50 text-red-700 overflow-auto" // Added overflow-auto here
                : "border-sky-200 bg-sky-50 text-slate-700"
            }`}
          >
            {aiError && !isAiTaskLoading ? ( // Only show error if not actively loading something else
              <p className="break-words">
                <strong>Error:</strong> {aiError}
              </p>
            ) : (
              <>
                <h4 className="font-semibold mb-2 text-sky-700">
                  {currentAiTask === "summarize" && "AI Generated Summary:"}
                  {currentAiTask === "extract_key_points" &&
                    "AI Extracted Key Points:"}
                  {currentAiTask === "custom_question" && "AI Answer:"}
                  {!currentAiTask &&
                    isAiTaskLoading &&
                    "Processing AI Request..."}{" "}
                  {/* Fallback title when loading but task not set yet */}
                </h4>
                <div className="whitespace-pre-wrap break-words">
                  {aiResultText}
                </div>
                {isAiTaskLoading && (
                  <Loader2
                    size={16}
                    className="inline-block animate-spin ml-2 my-1 text-sky-600"
                  />
                )}

                {/* Show copy button only when not loading and there's actual result text */}
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
                      <ClipboardCopy size={16} className="mr-1.5" /> Copy Result
                    </StyledButton>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

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
