// app/components/DynamicHeader.tsx
"use client";

import {usePage} from "@/app/contexts/PageContext";
import UserNav from "./UserNav";
import {useState, useRef, useEffect} from "react";
import {useRouter} from "next/navigation";
import {ChevronDown, Edit, Trash2} from "lucide-react";
import clsx from "clsx";
import Modal from "./Modal";
import StyledButton from "./StyledButton";
import {deleteJobAction, renameJobAction} from "@/actions/jobActions";

export default function DynamicHeader() {
  const {title, jobId, triggerRefetch} = usePage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // State for modals
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  const router = useRouter();

  useEffect(() => {
    setNewTitle(title);
  }, [title]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef]);

  const handleRename = async () => {
    if (!jobId || !newTitle.trim()) return;
    const result = await renameJobAction(jobId, newTitle.trim());
    if (result.success) {
      triggerRefetch();
    }
    setIsRenameModalOpen(false);
  };

  const handleDelete = async () => {
    if (!jobId) return;
    await deleteJobAction(jobId);
    setIsDeleteModalOpen(false);
    router.refresh();
  };

  if (!title) {
    return (
      <header
        id="page-header"
        className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-end bg-[var(--header-bg)] px-6"
      >
        <UserNav />
      </header>
    );
  }

  return (
    <>
      <header
        id="page-header"
        className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between bg-[var(--header-bg)] px-6"
      >
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-1.5 rounded-lg p-2 font-semibold text-[var(--text-primary)] transition-colors hover:bg-slate-200/60 dark:hover:bg-slate-700"
            disabled={!jobId}
          >
            {/* The font size is now smaller and the max-width is larger */}
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
            <StyledButton variant="danger" onClick={handleDelete}>
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
    </>
  );
}
