// app/components/HistorySidebar.tsx
"use client";

import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import {useState, useRef, useEffect} from "react";
import type {TranscriptionJob} from "@prisma/client";
import {
  FileText,
  Link2,
  MoreHorizontal,
  Edit,
  Trash2,
  Search,
  FilePenLine,
} from "lucide-react";
import clsx from "clsx";
import {deleteJobAction, renameJobAction} from "@/actions/jobActions";
import Modal from "./Modal";
import StyledButton from "./StyledButton";
import SidebarToggleIcon from "./icons/SidebarToggleIcon";
import QuickScribeStaticLogo from "./icons/QuickScribeStaticLogo";
import SearchModal from "./SearchModal";
import {usePage} from "../contexts/PageContext";

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
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const {triggerRefetch} = usePage();
  const pathSegments = pathname.split("/");
  const router = useRouter();
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
    const result = await renameJobAction(jobToEdit.id, newTitle.trim());
    if (result.success) {
      if (jobToEdit.id === activeJobId) {
        triggerRefetch();
      }
    }
    setIsRenameModalOpen(false);
    setJobToEdit(null);
  };

  const handleDeleteConfirm = async () => {
    if (!jobToDelete) return;
    await deleteJobAction(jobToDelete.id);
    setIsDeleteModalOpen(false);
    setJobToDelete(null);
    router.refresh();
  };

  return (
    <>
      <div
        className={clsx(
          "bg-[var(--sidebar-bg)] border-[var(--border-color)] transition-all duration-300 ease-in-out h-full flex flex-col flex-shrink-0 shadow-xl",
          isCollapsed ? "w-16" : "w-72"
        )}
      >
        <div
          className={clsx(
            "flex h-16 items-center  border-[var(--border-color)]",
            isCollapsed ? "justify-center" : "justify-between px-3"
          )}
        >
          {isCollapsed ? (
            <button
              onClick={() => setIsCollapsed(false)}
              className="group flex h-full w-full items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700/50"
              aria-label="Expand sidebar"
            >
              <QuickScribeStaticLogo className="h-7 w-auto group-hover:hidden text-[var(--text-primary)]" />
              <SidebarToggleIcon className="hidden group-hover:block rotate-180 " />
            </button>
          ) : (
            <>
              <Link href="/" aria-label="Home">
                <QuickScribeStaticLogo className="h-7 w-auto" />
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

        {/* --- THIS IS THE FIX: New menu items, hidden when collapsed --- */}
        <div className={clsx("p-3 space-y-1", isCollapsed && "hidden")}>
          <Link
            href="/"
            className="flex w-full items-center rounded-md p-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-slate-200/50 dark:hover:bg-slate-700"
          >
            <FilePenLine size={18} className="mr-3" />
            New Transcription
          </Link>
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="flex w-full items-center rounded-md p-2 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-slate-200/50 dark:hover:bg-slate-700"
          >
            <Search size={18} className="mr-3" />
            Search
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          <h3
            className={clsx(
              "px-2 pt-4 pb-2 text-xs font-semibold text-slate-500 dark:text-slate-400",
              isCollapsed && "hidden"
            )}
          >
            Transcription
          </h3>
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
                      ? "bg-slate-200 dark:bg-slate-800 font-semibold"
                      : "hover:bg-slate-200/60 dark:hover:bg-slate-700"
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
                      className="absolute right-2 top-full z-10 mt-1 w-32 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] p-1 shadow-xl"
                    >
                      <button
                        onClick={() => {
                          setJobToEdit(job);
                          setNewTitle(job.displayTitle || "");
                          setIsRenameModalOpen(true);
                          setOpenMenuId(null);
                        }}
                        className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-slate-200/60 dark:hover:bg-slate-700"
                      >
                        <Edit size={14} className="mr-2.5" />
                        Rename
                      </button>
                      <button
                        onClick={() => {
                          setJobToDelete(job);
                          setIsDeleteModalOpen(true);
                          setOpenMenuId(null);
                        }}
                        className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-red-500 transition-colors hover:bg-red-500/10"
                      >
                        <Trash2 size={14} className="mr-2.5" />
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
        title=""
      >
        <div className="space-y-4 p-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Rename Transcription
          </h2>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--card-secondary-bg)] border border-[var(--border-color)] rounded-lg text-base focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTitle.trim()) {
                handleRename();
              }
            }}
          />
          <div className="flex justify-end gap-3 pt-2">
            <StyledButton
              variant="secondary"
              onClick={() => setIsRenameModalOpen(false)}
            >
              Cancel
            </StyledButton>
            <StyledButton onClick={handleRename} disabled={!newTitle.trim()}>
              Save
            </StyledButton>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        size="sm" // Use a smaller modal width
        position="center" // Ensure it's centered
      >
        <div className="p-6 text-left">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Delete Transcription?
          </h2>
          <div className="mt-2 mb-6">
            <p className="text-sm text-[var(--text-primary)]">
              Are you sure you want to delete this transcription? This action
              cannot be undone.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <StyledButton variant="danger" onClick={handleDeleteConfirm}>
              Delete
            </StyledButton>
            <StyledButton
              variant="secondary"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </StyledButton>
          </div>
        </div>
      </Modal>
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        recentJobs={jobs}
      />
    </>
  );
}
