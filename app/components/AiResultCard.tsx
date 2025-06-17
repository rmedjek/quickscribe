// app/components/AiResultCard.tsx
"use client";

import React from "react";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ClipboardCopy,
  XCircle,
  AlertCircle,
  Copy as CopyIcon,
  CopyCheck as CopyCheckIcon,
} from "lucide-react";
import StyledButton from "./StyledButton";
import {AIInteractionTaskType} from "@/actions/interactWithTranscriptAction"; // Assuming this is where the type is defined
import {AiResultItem, LIST_TASK_TYPES, parseListItems} from "@/types/app";

// --- Skeleton Sub-Component ---
const AiResultSkeleton: React.FC = () => (
  <div className="p-4">
    <div className="animate-pulse flex space-x-4">
      <div className="flex-1 space-y-4 py-1">
        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
        <div className="space-y-2">
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
        </div>
        <div className="pt-2 flex justify-end">
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
        </div>
      </div>
    </div>
  </div>
);

// --- Main AiResultCard Component ---
interface AiResultCardProps {
  result: AiResultItem;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onRegenerate: (taskType: AIInteractionTaskType) => void;
  onCopyListItem: (
    itemText: string,
    resultId: string,
    itemIndex: number
  ) => void;
  copiedListItemId: string | null;
  isAnyTaskStreaming: boolean;
  getTaskDisplayName: (taskType: AIInteractionTaskType) => string;
  newlyAddedResultId: string | null;
}

export const AiResultCard: React.FC<AiResultCardProps> = ({
  result,
  isExpanded,
  onToggle,
  onRemove,
  onRegenerate,
  onCopyListItem,
  copiedListItemId,
  isAnyTaskStreaming,
  getTaskDisplayName,
  newlyAddedResultId,
}) => {
  const renderContent = () => {
    if (result.isStreaming && !result.text) {
      return <AiResultSkeleton />;
    }
    if (result.error) {
      return (
        <p className="text-red-600 dark:text-red-400 break-words">
          <strong>Error generating this result:</strong> {result.error}
        </p>
      );
    }
    if (!result.text) return null; // Don't render anything if there's no text and it's not streaming

    if (LIST_TASK_TYPES.has(result.taskType)) {
      // Render as a list
      return (
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
                  onClick={() => onCopyListItem(item, result.id, index)}
                  className="ml-2 p-1 rounded-md text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-opacity"
                  aria-label={`Copy item: ${item.substring(0, 40)}...`}
                >
                  {isCopied ? (
                    <CopyCheckIcon size={16} className="text-green-500" />
                  ) : (
                    <CopyIcon size={16} />
                  )}
                </button>
              </li>
            );
          })}
          {result.isStreaming && (
            <span className="inline-block animate-ping w-1.5 h-1.5 bg-sky-500 rounded-full ml-2"></span>
          )}
        </ul>
      );
    }
    // Render as a single block
    return (
      <div className="whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">
        {result.text}
        {result.isStreaming && (
          <span className="inline-block animate-ping w-1.5 h-1.5 bg-sky-500 rounded-full ml-1"></span>
        )}
      </div>
    );
  };

  return (
    <div
      key={result.id}
      className={`border dark:border-slate-700 rounded-lg shadow-sm overflow-hidden ${
        result.id === newlyAddedResultId ? "ai-result-newly-added" : ""
      }`}
    >
      <button
        onClick={() => onToggle(result.id)}
        className={`w-full flex justify-between items-center p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:focus-visible:ring-sky-400 focus-visible:ring-inset transition-colors rounded-t-lg ${
          result.id === newlyAddedResultId && !isExpanded
            ? "bg-sky-50 dark:bg-sky-900/30"
            : isExpanded
            ? "bg-slate-200 dark:bg-slate-600"
            : "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
        }`}
        aria-expanded={isExpanded}
        aria-controls={`result-content-${result.id}`}
      >
        <span className="font-semibold flex items-center text-slate-800 dark:text-slate-100">
          {result.isStreaming && (
            <Loader2 size={16} className="animate-spin mr-2" />
          )}
          {getTaskDisplayName(result.taskType)}
        </span>
        {isExpanded ? (
          <ChevronUp size={20} className="text-slate-600 dark:text-slate-400" />
        ) : (
          <ChevronDown
            size={20}
            className="text-slate-600 dark:text-slate-400"
          />
        )}
      </button>
      {isExpanded && (
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
                Note: The AI processed a shortened version of the transcript due
                to its length. Results may not cover the entire content.
              </span>
            </div>
          )}
          {renderContent()}
          <div className="mt-4 flex justify-end items-center space-x-2">
            {result.taskType !== "custom_question" && (
              <StyledButton
                size="sm"
                variant="ghost"
                onClick={() => onRegenerate(result.taskType)}
                className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400"
                aria-label="Regenerate this result"
                disabled={isAnyTaskStreaming}
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
              className="text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-700/30"
              disabled={!result.text || !!result.error || result.isStreaming}
            >
              <ClipboardCopy size={14} className="mr-1.5" />
              Copy All
            </StyledButton>
            <StyledButton
              size="sm"
              variant="ghost"
              onClick={() => onRemove(result.id)}
              className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-500"
              aria-label={`Clear ${getTaskDisplayName(result.taskType)} result`}
            >
              <XCircle size={14} className="mr-1.5" />
              Clear
            </StyledButton>
          </div>
        </div>
      )}
    </div>
  );
};

export type {AiResultItem};
