// app/components/SearchModal.tsx
"use client";

import React, {useState, useEffect, useCallback} from "react";
import {useRouter} from "next/navigation";
import {Search, Loader2, X, MessageSquare, FilePenLine} from "lucide-react";
import Modal from "./Modal";
import {isToday, isYesterday, format} from "date-fns";
import type {TranscriptionJob} from "@prisma/client";

// --- Debounce Hook ---
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// --- Search Result Type ---
interface SearchResult {
  id: string;
  displayTitle: string;
  createdAt: string;
  snippet: string | null;
}

// --- THIS IS THE FIX: Date Grouping Helper Restored ---
const groupJobsByDate = (jobs: TranscriptionJob[]) => {
  const groups: {[key: string]: TranscriptionJob[]} = {};
  jobs.forEach((job) => {
    const jobDate = new Date(job.createdAt);
    let key: string;
    if (isToday(jobDate)) key = "Today";
    else if (isYesterday(jobDate)) key = "Yesterday";
    else key = format(jobDate, "MMMM d, yyyy"); // More specific grouping for older items
    if (!groups[key]) groups[key] = [];
    groups[key].push(job);
  });
  return groups;
};

// --- Main Component ---
export default function SearchModal({
  isOpen,
  onClose,
  recentJobs,
}: {
  isOpen: boolean;
  onClose: () => void;
  recentJobs: TranscriptionJob[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  // --- THIS IS THE FIX: Group recent jobs for the default view ---
  const groupedJobs = groupJobsByDate(recentJobs);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length === 0) {
      setResults([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}`
      );
      if (!response.ok) throw new Error("Search failed");
      const data = (await response.json()) as SearchResult[];
      setResults(data);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  const handleResultClick = (jobId: string) => {
    setQuery("");
    onClose();
    router.push(`/job/${jobId}`);
  };

  // --- THIS IS THE FIX: Handler for "New Transcription" button restored ---
  const handleNewTranscription = () => {
    setQuery("");
    onClose();
    router.push("/");
  };

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => setQuery(""), 300);
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="flex flex-col h-full">
        {/* Search Input with embedded X button */}
        <div className="relative flex-shrink-0">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-11 pr-11 py-4 border-b border-[var(--border-color)] bg-transparent text-base focus:outline-none"
            autoFocus
          />
          {isLoading ? (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-gray-400" />
          ) : (
            query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            )
          )}
        </div>

        {/* --- THIS IS THE FIX: Conditional rendering for Search vs. Default view --- */}
        <div className="flex-1 overflow-y-auto p-2">
          {debouncedQuery.trim() ? (
            // Search Results View
            <>
              {results.length > 0 ? (
                <ul className="space-y-1 py-2">
                  {results.map((result) => (
                    <li key={result.id}>
                      <button
                        onClick={() => handleResultClick(result.id)}
                        className="w-full text-left p-3 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        {/* The icon and title are now on the same line */}
                        <div className="flex items-center text-sm font-semibold text-[var(--text-primary)]">
                          <MessageSquare
                            size={16}
                            className="mr-3 flex-shrink-0 text-gray-400"
                          />
                          <span className="truncate">
                            {result.displayTitle}
                          </span>
                        </div>

                        {/* The snippet is now below, indented to align with the title text */}
                        {result.snippet && (
                          <p
                            className="mt-1.5 pl-[28px] text-xs text-gray-400"
                            dangerouslySetInnerHTML={{__html: result.snippet}}
                          />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                !isLoading && (
                  <div className="text-center py-10 px-4">
                    <p className="font-semibold text-[var(--text-primary)]">
                      No results found
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Your search for &quot;{debouncedQuery}&quot; did not
                      return any results.
                    </p>
                  </div>
                )
              )}
            </>
          ) : (
            // Default View (Recent History)
            <div className="space-y-4 py-2">
              <button
                onClick={handleNewTranscription}
                className="w-full flex items-center p-3 text-left rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700/50"
              >
                <FilePenLine size={18} className="mr-3 text-gray-400" />
                <span className="font-semibold text-sm">New Transcription</span>
              </button>

              {Object.entries(groupedJobs).map(([groupTitle, jobsInGroup]) => (
                <div key={groupTitle}>
                  <h3 className="px-3 text-xs font-semibold text-gray-400 mb-1">
                    {groupTitle}
                  </h3>
                  <ul className="space-y-1">
                    {jobsInGroup.map((job) => (
                      <li key={job.id}>
                        <button
                          onClick={() => handleResultClick(job.id)}
                          className="w-full flex items-center p-3 text-left rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700/50"
                        >
                          <MessageSquare
                            size={18}
                            className="mr-3 text-gray-400"
                          />
                          <span className="text-sm truncate">
                            {job.displayTitle || job.sourceFileName}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
