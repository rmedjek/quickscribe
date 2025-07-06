// app/components/SearchModal.tsx
"use client";

import React, {useState, useEffect, useCallback, useRef} from "react";
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

// --- Types for API Response ---
interface SearchResult {
  id: string;
  displayTitle: string;
  createdAt: string;
  snippet: string | null;
}

interface PaginationState {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
}

interface SearchState {
  results: SearchResult[];
  pagination: PaginationState | null;
  isLoading: boolean;
  isLoadingMore: boolean;
}

// --- Date Grouping Helper ---
const groupJobsByDate = (jobs: TranscriptionJob[]) => {
  const groups: {[key: string]: TranscriptionJob[]} = {};
  jobs.forEach((job) => {
    const jobDate = new Date(job.createdAt);
    let key: string;
    if (isToday(jobDate)) key = "Today";
    else if (isYesterday(jobDate)) key = "Yesterday";
    else key = format(jobDate, "MMMM d, yyyy");
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
  const [searchState, setSearchState] = useState<SearchState>({
    results: [],
    pagination: null,
    isLoading: false,
    isLoadingMore: false,
  });

  const debouncedQuery = useDebounce(query, 300);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Group recent jobs for the default view
  const groupedJobs = groupJobsByDate(recentJobs);

  const performSearch = useCallback(async (searchQuery: string, page = 1) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    if (searchQuery.trim().length < 2) {
      // Allow empty query to clear results
      setSearchState({
        results: [],
        pagination: null,
        isLoading: false,
        isLoadingMore: false,
      });
      return;
    }

    setSearchState((prev) => ({
      ...prev,
      isLoading: page === 1,
      isLoadingMore: page > 1,
    }));

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&page=${page}`,
        {
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) throw new Error("Search failed");
      const data = await response.json();

      setSearchState((prev) => ({
        results: page === 1 ? data.results : [...prev.results, ...data.results],
        pagination: data.pagination,
        isLoading: false,
        isLoadingMore: false,
      }));
    } catch (error: any) {
      if (error.name === "AbortError") return;
      console.error("Search error:", error);
      setSearchState({
        results: [],
        pagination: null,
        isLoading: false,
        isLoadingMore: false,
      });
    }
  }, []);

  useEffect(() => {
    performSearch(debouncedQuery, 1);
  }, [debouncedQuery, performSearch]);

  const handleLoadMore = () => {
    if (searchState.pagination?.hasNext && !searchState.isLoadingMore) {
      performSearch(debouncedQuery, searchState.pagination.page + 1);
    }
  };

  const handleResultClick = (jobId: string) => {
    onClose();
    router.push(`/job/${jobId}`);
  };

  const handleNewTranscription = () => {
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
        {/* Search Input */}
        <div className="relative flex-shrink-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-11 pr-11 py-4 border-b border-[var(--border-color)] bg-transparent text-base focus:outline-none"
            autoFocus
          />
          {searchState.isLoading && !searchState.isLoadingMore ? (
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

        {/* --- THIS IS THE FIX: The full conditional logic is now correct --- */}
        <div className="flex-1 overflow-y-auto p-2">
          {debouncedQuery.trim().length > 1 ? (
            // SEARCH VIEW
            <>
              {searchState.results.length > 0 ? (
                <ul className="space-y-1 py-2">
                  {searchState.results.map((result) => (
                    <li key={result.id}>
                      <button
                        onClick={() => handleResultClick(result.id)}
                        className="w-full text-left p-3 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700/50"
                      >
                        <div className="flex items-center text-sm font-semibold text-[var(--text-primary)]">
                          <MessageSquare
                            size={16}
                            className="mr-3 flex-shrink-0 text-gray-400"
                          />
                          <span className="truncate">
                            {result.displayTitle}
                          </span>
                        </div>
                        {result.snippet && (
                          <p
                            className="mt-1.5 pl-[28px] text-xs text-gray-400"
                            dangerouslySetInnerHTML={{__html: result.snippet}}
                          />
                        )}
                      </button>
                    </li>
                  ))}
                  {searchState.pagination?.hasNext && (
                    <div className="text-center pt-4">
                      <button
                        onClick={handleLoadMore}
                        disabled={searchState.isLoadingMore}
                        className="text-sm font-semibold text-sky-500 hover:text-sky-600 disabled:opacity-50"
                      >
                        {searchState.isLoadingMore ? "Loading..." : "Load More"}
                      </button>
                    </div>
                  )}
                </ul>
              ) : (
                !searchState.isLoading && (
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
            // DEFAULT VIEW (recent history)
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
                  <h3 className="px-3 pt-2 text-xs font-semibold text-gray-400 mb-1">
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
