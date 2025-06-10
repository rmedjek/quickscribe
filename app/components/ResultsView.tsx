// app/components/ResultsView.tsx
"use client";

import React, {useState, useRef, useEffect} from "react";
import {
  CheckCircle2,
  ClipboardCopy,
  Download,
  Brain,
  Loader2,
  ListChecks,
  HelpCircle,
  Send,
  ClipboardCheck,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  XCircle,
  Trash2,
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
import { APP_STEPS } from "@/types/app";
import type { AppStep } from "@/types/app";


const modeLabel = (m: TranscriptionMode) => (m === "turbo" ? "Turbo" : "Chill");
const AI_INTERACTION_API_ENDPOINT = "/api/ai_interaction";

interface AiResultItem {
  id: string;
  taskType: AIInteractionTaskType;
  text: string;
  wasTruncated: boolean;
  error?: string;
}

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

  const [activeAiTask, setActiveAiTask] =
    useState<AIInteractionTaskType | null>(null);
  const [streamingAiText, setStreamingAiText] = useState<string>("");
  const [isStreamingAi, setIsStreamingAi] = useState(false);
  const [aiResults, setAiResults] = useState<AiResultItem[]>([]);
  const [globalAiError, setGlobalAiError] = useState<string | null>(null);
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);
  const [customQuestion, setCustomQuestion] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // For the visual cue on newly added result
  const [newlyAddedResultId, setNewlyAddedResultId] = useState<string | null>(
    null
  );

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Effect to remove the highlight after a delay for newly added results
  useEffect(() => {
    if (newlyAddedResultId) {
      const timer = setTimeout(() => {
        setNewlyAddedResultId(null);
      }, 1500); // Duration should match your CSS animation
      return () => clearTimeout(timer);
    }
  }, [newlyAddedResultId]);

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

  const getTaskDisplayName = (taskType: AIInteractionTaskType): string => {
    switch (taskType) {
      case "summarize":
        return "Summary";
      case "extract_key_points":
        return "Key Points";
      case "custom_question":
        return "Q&A Answer";
      case "extract_action_items":
        return "Action Items";
      default:
        console.warn(
          `[ResultsView] Unhandled AIInteractionTaskType in getTaskDisplayName: ${taskType}`
        );
        return "AI Generated Result";
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
      setGlobalAiError("Please enter a question.");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsStreamingAi(true);
    setActiveAiTask(taskType);
    setStreamingAiText("");
    setGlobalAiError(null);
    let taskWasTruncated = false;

    const body: AIInteractionParams = {
      transcriptText: transcriptionData.text,
      taskType: taskType,
      customPrompt:
        taskType === "custom_question" ? questionForTask : undefined,
    };

    body.transcriptText = transcriptionData.text;
    body.taskType = taskType;
    body.customPrompt =
      taskType === "custom_question" ? questionForTask : undefined;

    try {
      const response = await fetch(AI_INTERACTION_API_ENDPOINT, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      });
      // Not directly setting body here, but JSON.stringify(body) will be used

      if (response.headers.get("X-Content-Truncated") === "true") {
        taskWasTruncated = true;
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
      let accumulatedText = "";

      while (true) {
        if (abortControllerRef.current?.signal.aborted) {
          console.log("Stream processing loop aborted for task:", taskType);
          throw new Error("STREAM_ABORTED_BY_NEW_REQUEST");
        }
        try {
          const {done, value} = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, {stream: true});
          accumulatedText += chunk;
          setStreamingAiText(accumulatedText);
        } catch (streamError: unknown) {
          const err = streamError as {name?: string; message?: string};
          if (err.name !== "AbortError") {
            setGlobalAiError(
              "Error reading stream: " + (err.message || "Unknown stream error")
            );
          } else {
            console.log("Stream reading aborted by client/controller.");
          }
          throw streamError; // Re-throw to be caught by outer catch
        }
      }

      await (async function processStream() {
        /* ... your existing processStream logic ... */
      })(); // IIFE to keep it async

      if (!abortControllerRef.current?.signal.aborted) {
        const newResultId = `${taskType}-${Date.now()}`;
        const newResult: AiResultItem = {
          id: newResultId,
          taskType,
          text: accumulatedText,
          wasTruncated: taskWasTruncated,
        };
        setAiResults((prevResults) => [newResult, ...prevResults]);
        setExpandedResultId(newResultId);
        setNewlyAddedResultId(newResultId);
        if (taskType === "custom_question") setCustomQuestion("");
      }
    } catch (error: unknown) {
      const err = error as {message?: string; name?: string};
      if (
        err.message === "STREAM_ABORTED_BY_NEW_REQUEST" ||
        err.name === "AbortError"
      ) {
        console.log(
          `AI task ${activeAiTask} aborted by new request or navigation.`
        );
      } else {
        setGlobalAiError(err.message || `Failed to process ${taskType} task.`);
      }
    } finally {
      setIsStreamingAi(false);
      setActiveAiTask(null);
      setStreamingAiText("");
      abortControllerRef.current = null;
    }
  };

  const handleQuestionSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    handleGenericAiStreamTask("custom_question", customQuestion);
  };

  const handleRemoveResult = (idToRemove: string) => {
    setAiResults((prev) => prev.filter((result) => result.id !== idToRemove));
    if (expandedResultId === idToRemove) {
      setExpandedResultId(null); // Collapse if the expanded one is removed
    }
  };

  const toggleResultExpansion = (id: string) => {
    setExpandedResultId((prevId) => (prevId === id ? null : id));
  };

  // NEW: Handler for Clearing All AI Results
  const handleClearAllAiResults = () => {
    setAiResults([]);
    setExpandedResultId(null);
    setGlobalAiError(null);
    setNewlyAddedResultId(null); // Also clear this
    // We won't stop an actively streaming task with this button for now
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-xl shadow-xl w-full max-w-lg md:max-w-xl mx-auto text-slate-700 dark:text-slate-200">
      {/* ... Header, Stepper, Main Title, Transcript Display, Download Buttons ... (Keep your existing code) */}
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50">
          QuickScribe
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Powered by Groq
        </p>
      </div>
      <GrayProgressStepper steps={APP_STEPS} />
      <div className="flex justify-center my-6">
        <CheckCircle2 size={72} className="text-gray-500 dark:text-slate-400" />
      </div>
      <h2 className="text-center text-xl font-semibold text-slate-900 dark:text-slate-50 mb-6">
        Transcripts generated successfully!
      </h2>
      <div className="relative mb-8">
        <button
          onClick={copyText}
          className="absolute right-3 top-3 p-1.5 rounded-md text-gray-600 dark:text-gray-300 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 dark:focus-visible:ring-sky-400 dark:focus-visible:ring-offset-slate-800 transition"
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
        <div className="max-h-56 overflow-y-auto p-4 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-sm leading-relaxed">
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
      <div className="my-8 py-6 border-t border-b border-slate-200 dark:border-slate-700 space-y-6">
        {/* MODIFIED: Header for AI Tools with Clear All button */}
        <div className="flex justify-between items-center mb-0">
          {" "}
          {/* Reduced mb if tools are directly below */}
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            AI Insights & Tools
          </h3>
          {aiResults.length > 0 && !isStreamingAi && (
            <StyledButton
              onClick={handleClearAllAiResults}
              variant="ghost"
              size="sm"
              className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-700/20"
              title="Clear all AI generated results"
            >
              <Trash2 size={14} className="mr-1.5" />
              Clear All
            </StyledButton>
          )}
        </div>

        {/* AI Quick Tool Buttons */}
        <div className="pt-1">
          {" "}
          {/* Removed the div and h3 that was here */}
          <div className="flex flex-col sm:flex-row flex-wrap justify-center items-center gap-3">
            {/* ... Your StyledButtons for Summarize, Key Points, Action Items ... */}
            {/* Ensure their isLoading is like: isLoading={isStreamingAi && activeAiTask === "summarize"} */}
            <StyledButton
              onClick={() => handleGenericAiStreamTask("summarize")}
              variant="secondary"
              isLoading={isStreamingAi && activeAiTask === "summarize"}
              disabled={isStreamingAi || !transcriptionData.text}
              className="group w-full sm:w-auto"
            >
              {isStreamingAi && activeAiTask === "summarize" ? (
                <Loader2 size={18} className="mr-2 animate-spin" />
              ) : (
                <Brain size={18} className="mr-2 group-hover:animate-pulse" />
              )}
              {isStreamingAi && activeAiTask === "summarize"
                ? "Summarizing..."
                : "Summarize"}
            </StyledButton>
            <StyledButton
              onClick={() => handleGenericAiStreamTask("extract_key_points")}
              variant="secondary"
              isLoading={isStreamingAi && activeAiTask === "extract_key_points"}
              disabled={isStreamingAi || !transcriptionData.text}
              className="group w-full sm:w-auto"
            >
              {isStreamingAi && activeAiTask === "extract_key_points" ? (
                <Loader2 size={18} className="mr-2 animate-spin" />
              ) : (
                <ListChecks
                  size={18}
                  className="mr-2 group-hover:scale-110 transition-transform"
                />
              )}
              {isStreamingAi && activeAiTask === "extract_key_points"
                ? "Extracting..."
                : "Key Points"}
            </StyledButton>
            <StyledButton
              onClick={() => handleGenericAiStreamTask("extract_action_items")}
              variant="secondary"
              isLoading={
                isStreamingAi && activeAiTask === "extract_action_items"
              }
              disabled={isStreamingAi || !transcriptionData.text}
              className="group w-full sm:w-auto"
            >
              {isStreamingAi && activeAiTask === "extract_action_items" ? (
                <Loader2 size={18} className="mr-2 animate-spin" />
              ) : (
                <ClipboardCheck
                  size={18}
                  className="mr-2 group-hover:rotate-[-3deg] transition-transform"
                />
              )}
              {isStreamingAi && activeAiTask === "extract_action_items"
                ? "Extracting..."
                : "Action Items"}
            </StyledButton>
          </div>
        </div>

        {/* Q&A Form */}
        <div>
          {/* ... Your Q&A Form ... */}
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3 text-center">
            <HelpCircle
              size={20}
              className="inline mr-1 mb-0.5 text-slate-400 dark:text-slate-500"
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
                className="flex-grow px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors text-sm"
                disabled={isStreamingAi || !transcriptionData.text}
              />
              <StyledButton
                type="submit"
                variant="primary"
                isLoading={isStreamingAi && activeAiTask === "custom_question"}
                disabled={
                  isStreamingAi ||
                  !transcriptionData.text ||
                  !customQuestion.trim()
                }
                className="flex-shrink-0 bg-sky-600 hover:bg-sky-700 focus-visible:ring-sky-500"
                size="icon"
              >
                {!(isStreamingAi && activeAiTask === "custom_question") && (
                  <Send size={18} />
                )}
              </StyledButton>
            </div>
          </form>
        </div>

        {/* Display Area for AI Results and current streaming text */}
        <div className="mt-6 space-y-3">
          {isStreamingAi && activeAiTask && (
            <div className="p-4 border border-sky-300 rounded-lg bg-sky-50 text-sm text-slate-700 dark:text-slate-200 shadow-inner">
              <h4 className="font-semibold mb-2 text-sky-600 flex items-center">
                <Loader2 size={16} className="animate-spin mr-2" />
                Generating {getTaskDisplayName(activeAiTask)}...
              </h4>
              {streamingAiText ? (
                <div className="whitespace-pre-wrap break-words mt-1">
                  {streamingAiText}
                  <span className="inline-block animate-ping w-1.5 h-1.5 bg-sky-500 rounded-full ml-1"></span>
                </div>
              ) : (
                <p className="text-slate-400 italic">
                  Waiting for AI response to start streaming...
                </p>
              )}
              {/* Truncation note for actively streaming task */}
              {/* We need to get wasTruncated for the active stream. This is tricky.
                        Let's assume the note appears with the final result for now.
                    */}
            </div>
          )}
          {globalAiError && !isStreamingAi && (
            <div className="p-3 border border-red-300 rounded-lg bg-red-50 text-sm text-red-700">
              <p className="break-words">
                <strong>Error:</strong> {globalAiError}
              </p>
            </div>
          )}

          {/* List of completed AI Results (Accordion) */}
          {aiResults.map((result) => (
            <div
              key={result.id}
              className={`border dark:border-slate-700 rounded-lg shadow-sm overflow-hidden ${
                result.id === newlyAddedResultId ? "ai-result-newly-added" : "" // Apply animation class
              }`}
            >
              <button
                onClick={() => toggleResultExpansion(result.id)}
                className={`w-full flex justify-between items-center p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:focus-visible:ring-sky-400 focus-visible:ring-inset transition-colors rounded-t-lg ${
                  result.id === newlyAddedResultId &&
                  expandedResultId !== result.id
                    ? "bg-sky-50 dark:bg-sky-900/30" // Slightly different bg for newly added but not expanded
                    : expandedResultId === result.id
                    ? "bg-slate-200 dark:bg-slate-600"
                    : "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
                aria-expanded={expandedResultId === result.id}
                aria-controls={`result-content-${result.id}`}
              >
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {getTaskDisplayName(result.taskType)}
                </span>
                {expandedResultId === result.id ? (
                  <ChevronUp
                    size={20}
                    className="text-slate-600 dark:text-slate-400"
                  />
                ) : (
                  <ChevronDown
                    size={20}
                    className="text-slate-600 dark:text-slate-400"
                  />
                )}
              </button>
              {expandedResultId === result.id && (
                <div
                  id={`result-content-${result.id}`}
                  className="p-4 border-t border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  {result.wasTruncated && (
                    <div className="mb-3 p-2.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-600 rounded-md flex items-center space-x-2">
                      <AlertCircle
                        size={16}
                        className="flex-shrink-0 text-amber-500 dark:text-amber-400"
                      />
                      <span>
                        Note: The AI processed a shortened version of the
                        transcript due to its length. Results may not cover the
                        entire content.
                      </span>
                    </div>
                  )}
                  {result.error ? (
                    <p className="text-red-600 dark:text-red-400 break-words">
                      <strong>Error generating this result:</strong>{" "}
                      {result.error}
                    </p>
                  ) : (
                    <div className="whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">
                      {result.text}
                    </div>
                  )}
                  <div className="mt-4 flex justify-end space-x-2">
                    <StyledButton
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        result.text &&
                        !result.error &&
                        navigator.clipboard.writeText(result.text)
                      }
                      className="text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-700/30 disabled:text-slate-400 dark:disabled:text-slate-500"
                      disabled={!result.text || !!result.error}
                    >
                      <ClipboardCopy size={14} className="mr-1.5" /> Copy
                    </StyledButton>
                    <StyledButton
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveResult(result.id)}
                      className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-700/20"
                    >
                      <XCircle size={14} className="mr-1.5" /> Clear
                    </StyledButton>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
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
      <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
        Transcription completed using <strong>{modeLabel(mode)}</strong> mode.
      </p>
    </div>
  );
}

function GrayProgressStepper({steps}: {steps: AppStep[]}) {
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
