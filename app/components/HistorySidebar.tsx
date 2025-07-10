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
import SidebarToggleIcon from "./icons/SidebarToggleIcon";
import QuickScribeStaticLogo from "./icons/QuickScribeStaticLogo";
import SearchModal from "./SearchModal";
import RenameModal from "./modals/RenameModal";
import DeleteConfirmationModal from "./modals/DeleteConfirmationModal";

export default function HistorySidebar({jobs}: {jobs: TranscriptionJob[]}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState<TranscriptionJob | null>(null);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<TranscriptionJob | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
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

  const handleRename = async (newTitle: string) => {
    if (!jobToEdit) return;
    const result = await renameJobAction(jobToEdit.id, newTitle);
    if (result.success && jobToEdit.id === activeJobId) {
      router.refresh();
    }
    setIsRenameModalOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!jobToDelete) return;
    await deleteJobAction(jobToDelete.id);
    setIsDeleteModalOpen(false);
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

      <RenameModal
        isOpen={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        initialTitle={
          jobToEdit?.displayTitle || jobToEdit?.sourceFileName || ""
        }
        onRename={handleRename}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
      />
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        recentJobs={jobs}
      />
    </>
  );
}
