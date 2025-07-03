// app/components/HistorySidebar.tsx
"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState, useRef, useEffect} from "react";
import type {TranscriptionJob} from "@prisma/client";
import {
  Plus,
  ChevronLeft,
  FileText,
  Link2,
  MoreHorizontal,
  Edit,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import {deleteJobAction, renameJobAction} from "@/actions/jobActions";
import Modal from "./Modal";
import StyledButton from "./StyledButton";

export default function HistorySidebar({jobs}: {jobs: TranscriptionJob[]}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState<TranscriptionJob | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

  const pathSegments = pathname.split("/");
  const activeJobId =
    pathSegments.length === 3 && pathSegments[1] === "job"
      ? pathSegments[2]
      : null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef]);

  const handleRename = async () => {
    if (!jobToEdit || !newTitle.trim()) return;
    await renameJobAction(jobToEdit.id, newTitle.trim());
    setIsRenameModalOpen(false);
    setJobToEdit(null);
  };

  return (
    <>
      <div
        className={clsx(
          "bg-[var(--sidebar-bg)]  border-[var(--border-color)] transition-all duration-300 ease-in-out h-full flex flex-col flex-shrink-0",
          isCollapsed ? "w-16" : "w-72"
        )}
      >
        <div className="p-3 flex items-center justify-between h-16 border-[var(--border-color)]">
          {!isCollapsed && (
            <Link
              href="/"
              className="bg-[var(--sidebar-bg)]  border-[var(--border-color)]"
            >
              QuickScribe
            </Link>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          >
            <ChevronLeft
              className={clsx(
                "transition-transform duration-300",
                isCollapsed && "rotate-180"
              )}
            />
          </button>
        </div>

        <div className="p-3">
          <Link
            href="/"
            className="flex items-center justify-center p-2 rounded-md text-sm font-semibold bg-sky-600 text-white hover:bg-sky-700 transition-colors"
          >
            <Plus size={18} className={clsx(!isCollapsed && "mr-2")} />
            {!isCollapsed && <span>New Transcription</span>}
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          {jobs.length === 0 ? (
            // If it's empty, we display a helpful message.
            <div className="p-4 text-center text-xs text-[var(--text-secondary)]">
              <p>No history yet.</p>
              <p className="mt-1">Your past transcriptions will appear here.</p>
            </div>
          ) : (
            // If it's not empty, we render the list of jobs.
            jobs.map((job) => {
              const isActive = activeJobId === job.id;
              return (
                <div key={job.id} className="relative group">
                  <Link
                    href={`/job/${job.id}`}
                    className={clsx(
                      "w-full flex items-center p-2 rounded-md text-sm text-[var(--text-secondary)] transition-colors",
                      isActive
                        ? "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-50 font-semibold"
                        : "hover:bg-slate-100 dark:hover:bg-slate-700/50"
                    )}
                  >
                    {job.sourceFileHash ? (
                      <FileText size={16} className="flex-shrink-0" />
                    ) : (
                      <Link2 size={16} className="flex-shrink-0" />
                    )}
                    {!isCollapsed && (
                      <span className="ml-3 truncate">
                        {job.displayTitle || job.sourceFileName}
                      </span>
                    )}
                  </Link>
                  {!isCollapsed && (
                    <button
                      onClick={() =>
                        setOpenMenuId(openMenuId === job.id ? null : job.id)
                      }
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  )}
                  {openMenuId === job.id && (
                    <div
                      ref={menuRef}
                      className="absolute z-10 right-2 top-10 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg py-1 text-slate-700 dark:text-slate-200"
                    >
                      <button
                        onClick={() => {
                          setJobToEdit(job);
                          setNewTitle(job.displayTitle || "");
                          setIsRenameModalOpen(true);
                          setOpenMenuId(null);
                        }}
                        className="w-full flex items-center px-3 py-1.5 text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <Edit size={14} className="mr-2" />
                        Rename
                      </button>
                      <button
                        onClick={() => deleteJobAction(job.id)}
                        className="w-full flex items-center px-3 py-1.5 text-sm text-left text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <Trash2 size={14} className="mr-2" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <Modal
        isOpen={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        title="Rename Transcription"
      >
        <div className="space-y-4">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-3 py-2 border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700"
          />
          <div className="flex justify-end gap-3">
            <StyledButton
              variant="secondary"
              onClick={() => setIsRenameModalOpen(false)}
            >
              Cancel
            </StyledButton>
            <StyledButton onClick={handleRename}>Save</StyledButton>
          </div>
        </div>
      </Modal>
    </>
  );
}
