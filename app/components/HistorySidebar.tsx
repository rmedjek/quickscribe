// app/components/HistorySidebar.tsx
"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState} from "react";
import type {TranscriptionJob} from "@prisma/client";
import {Plus, ChevronLeft, FileText, Link2} from "lucide-react";
import clsx from "clsx"; // A utility for constructing class names

export default function HistorySidebar({jobs}: {jobs: TranscriptionJob[]}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <div
      className={clsx(
        "relative bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-all duration-300 ease-in-out h-full flex flex-col",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="p-2 flex items-center justify-between">
        {!isCollapsed && (
          <h2 className="font-semibold text-lg text-slate-700 dark:text-slate-200 px-2">
            History
          </h2>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          <ChevronLeft
            className={clsx(
              "transition-transform duration-300",
              isCollapsed && "rotate-180"
            )}
          />
        </button>
      </div>

      <div className="p-2">
        <Link href="/" passHref>
          <div
            className={clsx(
              "flex items-center p-2 rounded-md text-sm font-semibold cursor-pointer",
              "bg-sky-600 text-white hover:bg-sky-700"
            )}
          >
            <Plus
              size={18}
              className={clsx("flex-shrink-0", !isCollapsed && "mr-2")}
            />
            {!isCollapsed && <span>New Transcription</span>}
          </div>
        </Link>
      </div>

      {/* Scrollable list of jobs */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {jobs.map((job) => {
          const isActive = pathname.endsWith(job.id);
          return (
            <Link key={job.id} href={`/dashboard/job/${job.id}`} passHref>
              <div
                title={job.sourceFileName}
                className={clsx(
                  "flex items-center p-2 rounded-md text-sm cursor-pointer transition-colors",
                  isActive
                    ? "bg-slate-200 dark:bg-slate-700"
                    : "hover:bg-slate-200/70 dark:hover:bg-slate-700/70"
                )}
              >
                {job.sourceFileHash ? (
                  <FileText size={16} className="flex-shrink-0" />
                ) : (
                  <Link2 size={16} className="flex-shrink-0" />
                )}
                {!isCollapsed && (
                  <span className="ml-3 truncate">{job.sourceFileName}</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
