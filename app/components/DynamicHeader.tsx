// app/components/DynamicHeader.tsx
"use client";

import {usePage} from "@/app/contexts/PageContext";
import UserNav from "./UserNav";
import {useState, useRef, useEffect} from "react";
import {ChevronDown, Edit, Trash2} from "lucide-react";
import clsx from "clsx";
import {deleteJobAction, renameJobAction} from "@/actions/jobActions";
import {useRouter} from "next/navigation";
import RenameModal from "./modals/RenameModal";
import DeleteConfirmationModal from "./modals/DeleteConfirmationModal";

export default function DynamicHeader() {
  const {title, jobId, setPageTitle} = usePage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef]);

  const handleRename = async (title: string) => {
    if (!jobId) return;
    setPageTitle(title, jobId);
    const result = await renameJobAction(jobId, title);
    if (result.success) {
      router.refresh();
    }
    setIsRenameModalOpen(false);
  };

  const handleDelete = async () => {
    if (!jobId) return;
    await deleteJobAction(jobId);
    setIsDeleteModalOpen(false);
    router.push("/");
  };

  return (
    <>
      <header
        id="page-header"
        className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between bg-[var(--header-bg)] px-6"
      >
        <div className="relative" ref={menuRef}>
          {/* The button is only enabled and shows the dropdown icon if there is a job ID */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-1.5 rounded-lg p-2 font-semibold text-[var(--text-primary)] transition-colors hover:bg-slate-200/60 disabled:pointer-events-none dark:hover:bg-slate-700"
            disabled={!jobId}
          >
            <span className="truncate max-w-md text-base">{title}</span>
            {jobId && (
              <ChevronDown
                size={20}
                className={clsx(
                  "transition-transform",
                  isMenuOpen && "rotate-180"
                )}
              />
            )}
          </button>

          {isMenuOpen && jobId && (
            <div className="absolute left-0 top-full z-10 mt-1 w-48 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] p-1 shadow-xl">
              <button
                onClick={() => {
                  setIsRenameModalOpen(true);
                  setIsMenuOpen(false);
                }}
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-slate-200/60 dark:hover:bg-slate-700"
              >
                <Edit size={14} className="mr-2.5" /> Rename
              </button>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(true);
                  setIsMenuOpen(false);
                }}
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-red-500 transition-colors hover:bg-red-500/10"
              >
                <Trash2 size={14} className="mr-2.5" /> Delete
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-4">
          <UserNav />
        </div>
      </header>

      {/* Modals for Rename and Delete */}
      <RenameModal
        isOpen={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        initialTitle={title}
        onRename={(newTitle) => handleRename(newTitle)}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
