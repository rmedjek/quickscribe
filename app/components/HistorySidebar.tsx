// app/components/HistorySidebar.tsx
"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState, useRef, useEffect} from "react";
import type {TranscriptionJob} from "@prisma/client";
import {
  Plus,
  FileText,
  Link2,
  MoreHorizontal,
  Edit,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import clsx from "clsx";
import {deleteJobAction, renameJobAction} from "@/actions/jobActions";
import Modal from "./Modal";
import StyledButton from "./StyledButton";
import SidebarToggleIcon from "./icons/SidebarToggleIcon";
import QuickScribeStaticLogo from "./icons/QuickScribeStaticLogo";

export default function HistorySidebar({jobs}: {jobs: TranscriptionJob[]}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState<TranscriptionJob | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<TranscriptionJob | null>(null);

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

  const handleDeleteConfirm = async () => {
    if (!jobToDelete) return;
    await deleteJobAction(jobToDelete.id);
    setIsDeleteModalOpen(false);
    setJobToDelete(null);
  };

  return (
    <>
      <div
        className={clsx(
          "bg-[var(--sidebar-bg)] border-r border-[var(--border-color)] transition-all duration-300 ease-in-out h-full flex flex-col flex-shrink-0",
          isCollapsed ? "w-16" : "w-72"
        )}
      >
        <div
          className={clsx(
            "flex h-16 items-center border-b border-[var(--border-color)]",
            isCollapsed ? "justify-center" : "justify-between px-3"
          )}
        >
          {isCollapsed ? (
            <button
              onClick={() => setIsCollapsed(false)}
              className="group flex h-full w-full items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700/50"
              aria-label="Expand sidebar"
            >
              <QuickScribeStaticLogo
                className="h-7 w-auto group-hover:hidden"
                color="#0ea5e9"
              />
              <SidebarToggleIcon className="hidden group-hover:block rotate-180 " />
            </button>
          ) : (
            <>
              <Link href="/" aria-label="Home">
                <QuickScribeStaticLogo className="h-7 w-auto" color="#0ea5e9" />
              </Link>
              <button
                onClick={() => setIsCollapsed(true)}
                className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 dark:text-white"
                aria-label="Collapse sidebar"
              >
                <SidebarToggleIcon className="transition-transform duration-300" />
              </button>
            </>
          )}
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
            <div
              className={clsx(
                "p-4 text-center text-xs text-[var(--text-secondary)]",
                isCollapsed && "hidden"
              )}
            >
              <p>No history yet.</p>
              <p className="mt-1">Your past transcriptions will appear here.</p>
            </div>
          ) : (
            jobs.map((job) => {
              const isActive = activeJobId === job.id;
              return (
                <div
                  key={job.id}
                  className={clsx(
                    "group relative flex items-center justify-between rounded-md p-2 text-sm transition-colors",
                    isActive
                      ? "bg-slate-200 dark:bg-slate-700 font-semibold"
                      : "hover:bg-slate-100 dark:hover:bg-slate-700/50"
                  )}
                >
                  <Link
                    href={`/job/${job.id}`}
                    className={clsx(
                      "flex flex-grow items-center truncate text-[var(--text-primary)]",
                      isActive && "text-slate-800 dark:text-slate-50"
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
                      className="ml-2 flex-shrink-0 rounded-md p-1 text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-slate-300 dark:text-slate-400 dark:hover:bg-slate-600"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  )}

                  {openMenuId === job.id && (
                    <div
                      ref={menuRef}
                      // This positioning is now correct relative to the parent div
                      className="absolute right-2 top-10 z-10 w-40 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <button
                        onClick={() => {
                          setJobToEdit(job);
                          setNewTitle(job.displayTitle || "");
                          setIsRenameModalOpen(true);
                          setOpenMenuId(null);
                        }}
                        className="flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <Edit size={14} className="mr-2" />
                        Rename
                      </button>
                      <button
                        onClick={() => {
                          setJobToDelete(job);
                          setIsDeleteModalOpen(true);
                          setOpenMenuId(null);
                        }}
                        className="flex w-full items-center px-3 py-1.5 text-left text-sm text-red-600 hover:bg-slate-100 dark:text-red-400 dark:hover:bg-slate-700"
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
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
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
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Transcription?"
      >
        <div className="space-y-6">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 sm:h-8 sm:w-8">
              <AlertTriangle
                className="h-6 w-6 text-red-600 dark:text-red-400"
                aria-hidden="true"
              />
            </div>
            <div className="flex-1">
              <p className="text-sm text-[var(--text-secondary)]">
                Are you sure you want to delete this transcription?
                <br />
                <strong className="font-medium text-[var(--text-primary)] break-all">
                  {jobToDelete?.displayTitle || jobToDelete?.sourceFileName}
                </strong>
                <br />
                This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <StyledButton
              variant="secondary"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </StyledButton>
            <StyledButton variant="danger" onClick={handleDeleteConfirm}>
              Delete Transcription
            </StyledButton>
          </div>
        </div>
      </Modal>
    </>
  );
}
