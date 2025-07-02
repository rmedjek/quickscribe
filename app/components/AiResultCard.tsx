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
import {AIInteractionTaskType} from "@/actions/interactWithTranscriptAction";
import {AiResultItem, LIST_TASK_TYPES, parseListItems} from "@/types/app";
import clsx from "clsx"; // Import clsx for conditional classes

// --- THIS IS THE FIX for the Skeleton ---
// The skeleton now uses darker colors that will be visible on our dark card background.
const AiResultSkeleton: React.FC = () => (
  <div className="p-4">
    <div className="animate-pulse flex space-x-4">
      <div className="flex-1 space-y-4 py-1">
        <div className="h-2 bg-slate-300 dark:bg-slate-600 rounded w-3/4"></div>
        <div className="space-y-2">
          <div className="h-2 bg-slate-300 dark:bg-slate-600 rounded"></div>
          <div className="h-2 bg-slate-300 dark:bg-slate-600 rounded w-5/6"></div>
        </div>
      </div>
    </div>
  </div>
);
// --- END FIX ---

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
          <strong>Error:</strong> {result.error}
        </p>
      );
    }
    if (!result.text) return null;

    if (LIST_TASK_TYPES.has(result.taskType)) {
      return (
        <ul className="space-y-2.5 text-[var(--text-primary)]">
          {parseListItems(result.text).map((item, index) => {
            const uniqueItemId = `${result.id}-${index}`;
            const isCopied = copiedListItemId === uniqueItemId;
            return (
              <li key={uniqueItemId} className="group flex items-start text-sm">
                <span className="mr-2.5 mt-0.5 text-sky-500 dark:text-sky-400">
                  •
                </span>
                <span className="flex-grow">{item}</span>
                <button
                  onClick={() => onCopyListItem(item, result.id, index)}
                  className="ml-2 p-1 rounded-md text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100"
                  aria-label={`Copy item`}
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
    return (
      <div className="whitespace-pre-wrap break-words text-sm text-[var(--text-primary)]">
        {result.text}
        {result.isStreaming && (
          <span className="inline-block animate-ping w-1.5 h-1.5 bg-sky-500 rounded-full ml-1"></span>
        )}
      </div>
    );
  };

  return (
    // --- THIS IS THE FIX for the main card styles ---
    <div
      key={result.id}
      className={clsx(
        "bg-[var(--card-primary-bg)] rounded-lg overflow-hidden",
        result.id === newlyAddedResultId ? "ai-result-newly-added" : ""
      )}
    >
      <button
        onClick={() => onToggle(result.id)}
        className="w-full flex justify-between items-center p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        aria-expanded={isExpanded}
        aria-controls={`result-content-${result.id}`}
      >
        <span className="font-semibold flex items-center text-[var(--text-primary)]">
          {result.isStreaming && (
            <Loader2 size={16} className="animate-spin mr-2" />
          )}
          {getTaskDisplayName(result.taskType)}
        </span>
        {isExpanded ? (
          <ChevronUp size={20} className="text-[var(--text-secondary)]" />
        ) : (
          <ChevronDown size={20} className="text-[var(--text-secondary)]" />
        )}
      </button>

      {isExpanded && (
        <div id={`result-content-${result.id}`} className="px-3 pb-3">
          {result.wasTruncated && (
            <div
              className="mb-3 p-2.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-600
             rounded-md flex items-center space-x-2"
            >
              <AlertCircle
                size={16}
                className="flex-shrink-0 text-amber-500 dark:text-amber-400"
              />
              <span>
                Note: The AI processed a shortened version of the transcript due
                to its length.
              </span>
            </div>
          )}

          <div className="p-4 bg-[var(--card-bg)] rounded-md">
            {renderContent()}
          </div>

          <div className="mt-4 flex justify-end items-center space-x-2">
            {result.taskType !== "custom_question" && (
              <StyledButton
                size="sm"
                variant="secondary"
                onClick={() => onRegenerate(result.taskType)}
                disabled={isAnyTaskStreaming}
              >
                <RefreshCw size={14} className="mr-1.5" />
                Regenerate
              </StyledButton>
            )}
            <StyledButton
              size="sm"
              variant="secondary"
              onClick={() =>
                result.text &&
                !result.error &&
                navigator.clipboard.writeText(result.text)
              }
              disabled={!result.text || !!result.error || result.isStreaming}
            >
              <ClipboardCopy size={14} className="mr-1.5" />
              Copy All
            </StyledButton>
            <StyledButton
              size="sm"
              variant="danger"
              onClick={() => onRemove(result.id)}
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
