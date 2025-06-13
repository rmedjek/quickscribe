/* eslint-disable @typescript-eslint/no-explicit-any */
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
  Copy as CopyIcon,
  CopyCheck as CopyCheckIcon,
  Hash,
  RefreshCw,
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
import {APP_STEPS, TRANSCRIPTION_MODEL_DISPLAY_NAMES} from "@/types/app";
import type {AppStep} from "@/types/app";

const AI_INTERACTION_API_ENDPOINT = "/api/ai_interaction";

interface AiResultItem {
  id: string;
  taskType: AIInteractionTaskType;
  text: string;
  wasTruncated: boolean;
  error?: string;
}

const LIST_TASK_TYPES = new Set<AIInteractionTaskType>([
  "extract_key_points",
  "extract_action_items",
  "identify_topics",
]);

const parseListItems = (text: string): string[] => {
  if (!text) return [];
  const potentialItems = text
    .split("\n")
    .filter((line) => /^\s*(\*|-|\d+\.)\s+/.test(line));
  if (potentialItems.length > 0) {
    return potentialItems.map((line) =>
      line.replace(/^\s*(\*|-|\d+\.)\s+/, "").trim()
    );
  }
  return text.split("\n").filter((line) => line.trim() !== "");
};

interface Props {
  transcriptionData: DetailedTranscriptionResult;
  transcriptLanguage: string;
  mode: TranscriptionMode;
  onRestart: () => void;
}

export default function ResultsView({
  transcriptionData,
  transcriptLanguage,
  mode,
  onRestart,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [zipping, setZipping] = useState(false);

  // AI State
  const [activeAiTask, setActiveAiTask] =
    useState<AIInteractionTaskType | null>(null);
  const [isStreamingAi, setIsStreamingAi] = useState(false);
  const [aiResults, setAiResults] = useState<AiResultItem[]>([]);
  const [globalAiError, setGlobalAiError] = useState<string | null>(null);
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);
  const [customQuestion, setCustomQuestion] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const [newlyAddedResultId, setNewlyAddedResultId] = useState<string | null>(
    null
  );
  const [copiedListItemId, setCopiedListItemId] = useState<string | null>(null);
  const [aiOutputLanguage, setAiOutputLanguage] = useState(transcriptLanguage);

  type AiToolTab =
    | "summarize"
    | "extract_key_points"
    | "extract_action_items"
    | "identify_topics";

  const aiQuickTools: {
    name: string;
    taskType: AiToolTab;
    icon: React.ElementType;
  }[] = [
    {name: "Summarize", taskType: "summarize", icon: Brain},
    {name: "Key Points", taskType: "extract_key_points", icon: ListChecks},
    {
      name: "Action Items",
      taskType: "extract_action_items",
      icon: ClipboardCheck,
    },
    {name: "Topics", taskType: "identify_topics", icon: Hash},
  ];

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  useEffect(() => {
    if (newlyAddedResultId) {
      const timer = setTimeout(() => {
        setNewlyAddedResultId(null);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [newlyAddedResultId]);
  useEffect(() => {
    setAiOutputLanguage(transcriptLanguage);
  }, [transcriptLanguage]);

  const copyText = () =>
    navigator.clipboard.writeText(transcriptionData.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });

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
      case "identify_topics":
        return "Identified Topics";
      default:
        console.warn(`Unhandled task type: ${taskType}`);
        return "AI Result";
    }
  };

  const handleGenericAiStreamTask = async (
    taskType: AIInteractionTaskType,
    questionForTask?: string,
    forceRegenerate = false
  ) => {
    if (taskType !== "custom_question" && !forceRegenerate) {
      const existingResult = aiResults.find(
        (r) => r.taskType === taskType && !r.error
      );
      if (existingResult) {
        console.log(
          `[ResultsView] Found existing result for task: "${taskType}". Expanding and highlighting it.`
        );
        setExpandedResultId(existingResult.id);
        setNewlyAddedResultId(existingResult.id);
        return;
      }
    }
    if (forceRegenerate) {
      setAiResults((prev) => prev.filter((r) => r.taskType !== taskType));
    }
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
    setGlobalAiError(null);
    let taskWasTruncated = false;
    const body: AIInteractionParams = {
      transcriptText: transcriptionData.text,
      taskType: taskType,
      customPrompt:
        taskType === "custom_question" ? questionForTask : undefined,
      outputLanguage: aiOutputLanguage,
    };

    try {
      const response = await fetch(AI_INTERACTION_API_ENDPOINT, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      });

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
        try {
          const {done, value} = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, {stream: true});
          accumulatedText += chunk;
        } catch (streamError: any) {
          if (streamError.name !== "AbortError") {
            setGlobalAiError(
              "Error reading stream: " + (streamError.message || "Unknown")
            );
          }
          throw streamError;
        }
      }

      if (!abortControllerRef.current?.signal.aborted) {
        const newResultId = `${taskType}-${Date.now()}`;
        setAiResults((prev) => [
          {
            id: newResultId,
            taskType,
            text: accumulatedText,
            wasTruncated: taskWasTruncated,
          },
          ...prev,
        ]);
        setExpandedResultId(newResultId);
        setNewlyAddedResultId(newResultId);
        if (taskType === "custom_question") setCustomQuestion("");
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        setGlobalAiError(
          error.message || `Failed to process ${taskType} task.`
        );
      } else {
        console.log(`AI task ${activeAiTask} aborted.`);
      }
    } finally {
      setIsStreamingAi(false);
      setActiveAiTask(null);
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
      setExpandedResultId(null);
    }
  };

  const toggleResultExpansion = (id: string) => {
    setExpandedResultId((prevId) => (prevId === id ? null : id));
  };

  const handleClearAllAiResults = () => {
    setAiResults([]);
    setExpandedResultId(null);
    setGlobalAiError(null);
    setNewlyAddedResultId(null);
  };

  const handleCopyListItem = (
    itemText: string,
    resultId: string,
    itemIndex: number
  ) => {
    navigator.clipboard.writeText(itemText).then(() => {
      const uniqueId = `${resultId}-${itemIndex}`;
      setCopiedListItemId(uniqueId);
      setTimeout(() => {
        setCopiedListItemId((prevId) => (prevId === uniqueId ? null : prevId));
      }, 2000);
    });
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-xl shadow-xl w-full max-w-lg md:max-w-xl mx-auto text-slate-700 dark:text-slate-200">
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

      {/* --- REFACTORED AI Interaction Section --- */}
      <div className="my-8 py-6 border-t border-b border-slate-200 dark:border-slate-700 space-y-6">
        {/* --- Part 1: Quick Tools as Tabs --- */}
        <div>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-3">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              AI Insights
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Language:
              </span>
              <div className="inline-flex rounded-md shadow-sm bg-slate-100 dark:bg-slate-700 p-1">
                <button
                  onClick={() => setAiOutputLanguage(transcriptLanguage)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    aiOutputLanguage === transcriptLanguage
                      ? "bg-white dark:bg-slate-600 shadow text-sky-600 dark:text-sky-300 font-semibold"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/50"
                  }`}
                >
                  {new Intl.DisplayNames(["en"], {type: "language"})
                    .of(transcriptLanguage)
                    ?.split(" ")[0] || transcriptLanguage.toUpperCase()}
                </button>
                {transcriptLanguage !== "en" && (
                  <button
                    onClick={() => setAiOutputLanguage("en")}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      aiOutputLanguage === "en"
                        ? "bg-white dark:bg-slate-600 shadow text-sky-600 dark:text-sky-300 font-semibold"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/50"
                    }`}
                  >
                    English
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200 dark:border-slate-600">
            <nav
              className="-mb-px flex space-x-4 overflow-x-auto"
              aria-label="Tabs"
            >
              {aiQuickTools.map((tool) => {
                const isLoadingThisTab =
                  isStreamingAi && activeAiTask === tool.taskType;
                return (
                  <button
                    key={tool.taskType}
                    onClick={() => handleGenericAiStreamTask(tool.taskType)} // Tab click now triggers the action
                    disabled={isStreamingAi || !transcriptionData.text} // Disable all tabs while any task is running
                    className={`group shrink-0 inline-flex items-center justify-center py-2 px-3 border-b-2 font-medium text-sm transition-colors disabled:opacity-60 disabled:pointer-events-none border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-500`}
                    aria-busy={isLoadingThisTab}
                  >
                    {isLoadingThisTab ? (
                      <Loader2 size={16} className="mr-2 animate-spin" />
                    ) : (
                      <tool.icon size={16} className="mr-2" />
                    )}
                    <span>
                      {isLoadingThisTab ? "Generating..." : tool.name}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* --- Part 2: Q&A Section --- */}
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3 text-center">
            <HelpCircle
              size={20}
              className="inline mr-1 mb-0.5 text-slate-400 dark:text-slate-500"
            />{" "}
            Ask a Question
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

        {/* --- Part 3: Results Area --- */}
        <div className="mt-6 space-y-4">
          {(aiResults.length > 0 || isStreamingAi || globalAiError) && (
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
              <h4 className="text-base font-semibold text-slate-700 dark:text-slate-200">
                Generated Insights
              </h4>
              {aiResults.length > 0 && !isStreamingAi && (
                <StyledButton
                  onClick={handleClearAllAiResults}
                  variant="ghost"
                  size="sm"
                  className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-500"
                  aria-label="Clear all AI results"
                >
                  <Trash2 size={14} className="mr-1.5" />
                  Clear All
                </StyledButton>
              )}
            </div>
          )}

          {globalAiError && !isStreamingAi && (
            <div className="p-3 border border-red-300 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300">
              <p className="break-words">
                <strong>Error:</strong> {globalAiError}
              </p>
            </div>
          )}

          {aiResults.map((result) => (
            <div
              key={result.id}
              className={`border dark:border-slate-700 rounded-lg shadow-sm overflow-hidden ${
                result.id === newlyAddedResultId ? "ai-result-newly-added" : ""
              }`}
            >
              <button
                onClick={() => toggleResultExpansion(result.id)}
                className={`w-full flex justify-between items-center p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:focus-visible:ring-sky-400 focus-visible:ring-inset transition-colors rounded-t-lg ${
                  result.id === newlyAddedResultId &&
                  expandedResultId !== result.id
                    ? "bg-sky-50 dark:bg-sky-900/30"
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
                    <div className="mb-3 p-2.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-700 border border-amber-300 dark:border-amber-600 rounded-md flex items-center space-x-2">
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
                  {!result.error &&
                    result.text &&
                    (LIST_TASK_TYPES.has(result.taskType) ? (
                      <ul className="space-y-2.5">
                        {parseListItems(result.text).map((item, index) => {
                          const uniqueItemId = `${result.id}-${index}`;
                          const isCopied = copiedListItemId === uniqueItemId;
                          return (
                            <li
                              key={uniqueItemId}
                              className="group flex items-start text-sm text-slate-700 dark:text-slate-200"
                            >
                              <span className="mr-2.5 mt-0.5 text-sky-500 dark:text-sky-400">
                                •
                              </span>
                              <span className="flex-grow">{item}</span>
                              <button
                                onClick={() =>
                                  handleCopyListItem(item, result.id, index)
                                }
                                className="ml-2 p-1 rounded-md text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-opacity"
                                aria-label={`Copy item: ${item.substring(
                                  0,
                                  40
                                )}...`}
                              >
                                {isCopied ? (
                                  <CopyCheckIcon
                                    size={16}
                                    className="text-green-500"
                                  />
                                ) : (
                                  <CopyIcon size={16} />
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">
                        {result.text}
                      </div>
                    ))}
                  {result.error && (
                    <p className="text-red-600 dark:text-red-400 break-words">
                      <strong>Error generating this result:</strong>{" "}
                      {result.error}
                    </p>
                  )}
                  <div className="mt-4 flex justify-end items-center space-x-2">
                    {result.taskType !== "custom_question" && (
                      <StyledButton
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleGenericAiStreamTask(
                            result.taskType,
                            undefined,
                            true
                          )
                        }
                        className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-700/30"
                        aria-label="Regenerate this result"
                        disabled={isStreamingAi}
                      >
                        <RefreshCw size={14} className="mr-1.5" />
                        Regenerate
                      </StyledButton>
                    )}
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
                      <ClipboardCopy size={14} className="mr-1.5" />
                      Copy All
                    </StyledButton>
                    <StyledButton
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveResult(result.id)}
                      className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-700/20"
                      aria-label={`Clear ${getTaskDisplayName(
                        result.taskType
                      )} result`}
                    >
                      <XCircle size={14} className="mr-1.5" />
                      Clear
                    </StyledButton>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <StyledButton
        onClick={onRestart}
        variant="secondary"
        size="lg"
        className="w-full rounded-full mt-8 mb-6"
      >
        New Transcription
      </StyledButton>
      <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
        Transcription completed using{" "}
        <strong>{TRANSCRIPTION_MODEL_DISPLAY_NAMES[mode]}</strong> mode.
      </p>
    </div>
  );
}

function GrayProgressStepper({steps}: {steps: AppStep[]}) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol role="list" className="relative flex items-start justify-between">
        <div
          className="absolute top-3.5 left-4 right-4 h-0.5 bg-gray-200 dark:bg-slate-700"
          aria-hidden="true"
        />
        {steps.map((step) => (
          <li
            key={step.id}
            className="relative flex flex-col items-center w-1/3"
          >
            <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-400 dark:bg-slate-600 text-white">
              <step.icon className="h-5 w-5" />
            </div>
            <p className="text-xs text-center mt-2 w-20 truncate text-gray-500 dark:text-slate-400">
              {step.name}
            </p>
          </li>
        ))}
      </ol>
    </nav>
  );
}
