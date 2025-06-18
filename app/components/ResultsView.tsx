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
  Trash2,
  Hash,
  Mail,
} from "lucide-react";
import StyledButton from "./StyledButton";
import DownloadButton from "./DownloadButton";
import JSZip from "jszip";
import Modal from "./Modal";
import {DetailedTranscriptionResult} from "@/actions/transcribeAudioAction";
import {
  AIInteractionTaskType,
  AIInteractionParams,
} from "@/actions/interactWithTranscriptAction";
import {APP_STEPS, TRANSCRIPTION_MODEL_DISPLAY_NAMES} from "@/types/app";
import type {AppStep, TranscriptionMode} from "@/types/app";
import {AiResultCard, AiResultItem} from "./AiResultCard";

const AI_INTERACTION_API_ENDPOINT = "/api/ai_interaction";

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
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [draftedEmail, setDraftedEmail] = useState<{
    subject: string;
    body: string;
  } | null>(null);

  const aiQuickTools: {
    name: string;
    taskType: AIInteractionTaskType;
    icon: React.ElementType;
    description: string;
  }[] = [
    {
      name: "Summarize",
      taskType: "summarize",
      icon: Brain,
      description: "Get a concise summary.",
    },
    {
      name: "Key Points",
      taskType: "extract_key_points",
      icon: ListChecks,
      description: "List the main takeaways.",
    },
    {
      name: "Action Items",
      taskType: "extract_action_items",
      icon: ClipboardCheck,
      description: "Find tasks and to-dos.",
    },
    {
      name: "Topics",
      taskType: "identify_topics",
      icon: Hash,
      description: "Discover the main subjects.",
    },
    {
      name: "Draft Email",
      taskType: "draft_email",
      icon: Mail,
      description: "Create a summary email.",
    },
  ];

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);
  useEffect(() => {
    if (newlyAddedResultId) {
      const timer = setTimeout(() => setNewlyAddedResultId(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [newlyAddedResultId]);
  useEffect(() => {
    setAiOutputLanguage(transcriptLanguage);
  }, [transcriptLanguage]);

  const copyText = () => {
    navigator.clipboard.writeText(transcriptionData.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getTaskDisplayName = (taskType: AIInteractionTaskType): string => {
    if (taskType === "custom_question") return "Q&A Answer";
    if (taskType === "draft_email") return "Email Draft";
    return (
      aiQuickTools.find((t) => t.taskType === taskType)?.name || "AI Result"
    );
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
      if (aiResults.length > 0) {
        const aiFolder = zip.folder("ai-insights");
        if (aiFolder) {
          aiResults.forEach((result) => {
            if (result.text && !result.error) {
              const fileName = `${result.taskType.replace(/_/g, "-")}.md`;
              const fileContent = `--- QuickScribe AI Insight ---\n\nTool: ${getTaskDisplayName(
                result.taskType
              )}\nGenerated: ${new Date().toLocaleString()}\nTruncated: ${
                result.wasTruncated
              }\n\n---\n\n${result.text}`;
              aiFolder.file(fileName, fileContent);
            }
          });
        }
      }
      const blob = await zip.generateAsync({type: "blob"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "quickscribe-results.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error creating zip file:", err);
      setGlobalAiError("Failed to create the zip file.");
    } finally {
      setZipping(false);
    }
  };

  const handleRemoveResult = (idToRemove: string) => {
    setAiResults((prev) => prev.filter((r) => r.id !== idToRemove));
    if (expandedResultId === idToRemove) setExpandedResultId(null);
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
    const uid = `${resultId}-${itemIndex}`;
    setCopiedListItemId(uid);
    setTimeout(() => {
      setCopiedListItemId((p) => (p === uid ? null : p));
    }, 2000);
  };
  const handleQuestionSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    handleGenericAiStreamTask("custom_question", customQuestion);
  };

  const handleGenericAiStreamTask = async (
    taskType: AIInteractionTaskType,
    questionForTask?: string,
    forceRegenerate = false
  ) => {
    if (!transcriptionData.text || (isStreamingAi && activeAiTask === taskType))
      return;
    if (
      taskType !== "custom_question" &&
      taskType !== "draft_email" &&
      !forceRegenerate
    ) {
      const existingResult = aiResults.find(
        (r) => r.taskType === taskType && !r.error
      );
      if (existingResult) {
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

    if (isStreamingAi) {
      abortControllerRef.current?.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsStreamingAi(true);
    setActiveAiTask(taskType);
    setGlobalAiError(null);
    const newResultId = `${taskType}-${Date.now()}`;
    if (taskType !== "draft_email") {
      const placeholder: AiResultItem = {
        id: newResultId,
        taskType,
        text: "",
        wasTruncated: false,
        isStreaming: true,
      };
      setAiResults((prev) => [
        placeholder,
        ...(forceRegenerate
          ? prev.filter((r) => r.taskType !== taskType)
          : prev),
      ]);
      setExpandedResultId(newResultId);
    } else {
      setDraftedEmail(null);
    }
    if (taskType === "custom_question") setCustomQuestion("");

    const body: AIInteractionParams = {
      transcriptText: transcriptionData.text,
      taskType,
      customPrompt: questionForTask,
      outputLanguage: aiOutputLanguage,
    };
    let taskWasTruncated = false;
    let accumulatedText = "";
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
        let e;
        try {
          e = await response.json();
        } catch {
          throw new Error(`API Error: ${response.status}`);
        }
        throw new Error(e.error || `API Error: ${response.status}`);
      }
      if (!response.body) throw new Error("Response body is null.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        accumulatedText += decoder.decode(value, {stream: true});
        if (taskType !== "draft_email") {
          setAiResults((curr) =>
            curr.map((r) =>
              r.id === newResultId ? {...r, text: accumulatedText} : r
            )
          );
        }
      }
      if (!abortControllerRef.current?.signal.aborted) {
        if (taskType === "draft_email") {
          const subjectMatch = accumulatedText.match(/Subject: (.*)/);
          const bodyMatch = accumulatedText.match(/Body: ([\s\S]*)/);
          setDraftedEmail({
            subject: subjectMatch ? subjectMatch[1].trim() : "Summary",
            body: bodyMatch ? bodyMatch[1].trim() : accumulatedText,
          });
          setIsEmailModalOpen(true);
        } else {
          setAiResults((curr) =>
            curr.map((r) =>
              r.id === newResultId
                ? {...r, isStreaming: false, wasTruncated: taskWasTruncated}
                : r
            )
          );
          setNewlyAddedResultId(newResultId);
        }
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        if (taskType === "draft_email") {
          setGlobalAiError(error.message);
        } else {
          setAiResults((curr) =>
            curr.map((r) =>
              r.id === newResultId
                ? {...r, isStreaming: false, error: error.message}
                : r
            )
          );
        }
      } else {
        if (taskType !== "draft_email") {
          setAiResults((curr) => curr.filter((r) => r.id !== newResultId));
        }
      }
    } finally {
      setIsStreamingAi(false);
      setActiveAiTask(null);
      abortControllerRef.current = null;
    }
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
        <DownloadButton
          label="VTT"
          fileContent={transcriptionData.vttContent || ""}
          fileName="transcript.vtt"
          mimeType="text/vtt"
          variant="secondary"
          size="sm"
        />
        <DownloadButton
          label="SRT"
          fileContent={transcriptionData.srtContent || ""}
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
          className="rounded-full px-6"
        >
          <Download size={18} className="mr-2" />
          {zipping ? "Zipping…" : "Download All (.zip)"}
        </StyledButton>
      </div>

      {/* --- REFACTORED AI Interaction Section --- */}
      <div className="my-8 py-6 border-t border-b border-slate-200 dark:border-slate-700 space-y-8">
        {/* --- AI Insights Grid --- */}
        <div>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              AI Tools
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
                  {(() => {
                    // IIFE for cleaner conditional logic
                    try {
                      // Ensure transcriptLanguage is a non-empty string before calling .of()
                      if (
                        transcriptLanguage &&
                        typeof transcriptLanguage === "string" &&
                        transcriptLanguage.trim() !== ""
                      ) {
                        const displayName = new Intl.DisplayNames(["en"], {
                          type: "language",
                        }).of(transcriptLanguage);
                        return (
                          displayName?.split(" ")[0] ||
                          transcriptLanguage.toUpperCase()
                        );
                      }
                      return transcriptLanguage?.toUpperCase() || "Unknown"; // Fallback for empty or invalid
                    } catch (e) {
                      console.warn(
                        "Error formatting language name:",
                        transcriptLanguage,
                        e
                      );
                      return transcriptLanguage?.toUpperCase() || "Lang"; // Further fallback
                    }
                  })()}
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

          {/* === MODIFIED GRID FOR BETTER STYLING === */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {aiQuickTools.map((tool, index) => {
              const isLoadingThisTool =
                isStreamingAi && activeAiTask === tool.taskType;
              const isLastItemAndOdd =
                index === aiQuickTools.length - 1 &&
                aiQuickTools.length % 2 !== 0;

              return (
                <button
                  key={tool.taskType}
                  onClick={() => handleGenericAiStreamTask(tool.taskType)}
                  disabled={isStreamingAi || !transcriptionData.text}
                  className={`p-3 rounded-lg text-left transition-colors flex items-start space-x-3
                    ${
                      isLastItemAndOdd
                        ? "sm:col-span-2 sm:w-1/2 sm:mx-auto"
                        : ""
                    }
                    ${
                      isLoadingThisTool
                        ? "bg-slate-200 dark:bg-slate-700/80 opacity-75 cursor-not-allowed"
                        : "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600/60 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
                    }`}
                >
                  <div className="flex-shrink-0 pt-0.5">
                    {isLoadingThisTool ? (
                      <Loader2
                        size={18}
                        className="animate-spin text-slate-500"
                      />
                    ) : (
                      <tool.icon
                        size={18}
                        className="text-sky-600 dark:text-sky-400"
                      />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                      {isLoadingThisTool ? "Generating..." : tool.name}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {tool.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* --- Q&A Section --- */}
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">
            <HelpCircle
              size={20}
              className="inline mr-1.5 mb-0.5 text-slate-400 dark:text-slate-500"
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

        <div className="mt-6 space-y-4">
          {(aiResults.length > 0 || globalAiError) && (
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
            <AiResultCard
              key={result.id}
              result={result}
              isExpanded={
                expandedResultId === result.id || result.isStreaming === true
              }
              onToggle={toggleResultExpansion}
              onRemove={handleRemoveResult}
              onRegenerate={(taskType) =>
                handleGenericAiStreamTask(taskType, undefined, true)
              }
              onCopyListItem={handleCopyListItem}
              copiedListItemId={copiedListItemId}
              isAnyTaskStreaming={isStreamingAi}
              getTaskDisplayName={getTaskDisplayName}
              newlyAddedResultId={newlyAddedResultId}
            />
          ))}
        </div>
      </div>

      <Modal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        title="Draft Email Summary"
      >
        {draftedEmail && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Subject
              </label>
              <div className="flex items-center space-x-2">
                <input
                  readOnly
                  value={draftedEmail.subject}
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700"
                />
                <StyledButton
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    navigator.clipboard.writeText(draftedEmail.subject)
                  }
                >
                  <ClipboardCopy size={16} className="mr-1.5" />
                  Copy
                </StyledButton>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Body
              </label>
              <div className="relative">
                <textarea
                  readOnly
                  value={draftedEmail.body}
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700 min-h-[250px] whitespace-pre-wrap"
                />
                <div className="absolute top-2 right-2">
                  <StyledButton
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      navigator.clipboard.writeText(draftedEmail.body)
                    }
                  >
                    <ClipboardCopy size={16} className="mr-1.5" />
                    Copy Body
                  </StyledButton>
                </div>
              </div>
            </div>
            <div className="pt-4 text-right">
              <StyledButton onClick={() => setIsEmailModalOpen(false)}>
                Close
              </StyledButton>
            </div>
          </div>
        )}
      </Modal>

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
