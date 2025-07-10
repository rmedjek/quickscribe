// app/components/modals/RenameModal.tsx
"use client";

import {useState, useEffect} from "react";
import Modal from "../Modal";
import StyledButton from "../StyledButton";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRename: (newTitle: string) => Promise<void>;
  initialTitle: string;
}

export default function RenameModal({
  isOpen,
  onClose,
  onRename,
  initialTitle,
}: Props) {
  const [newTitle, setNewTitle] = useState(initialTitle);

  useEffect(() => {
    if (isOpen) {
      setNewTitle(initialTitle);
    }
  }, [isOpen, initialTitle]);

  const handleConfirm = async () => {
    await onRename(newTitle);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" position="center">
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
              handleConfirm();
            }
          }}
        />
        <div className="flex justify-end gap-3 pt-2">
          <StyledButton variant="secondary" onClick={onClose}>
            Cancel
          </StyledButton>
          <StyledButton onClick={handleConfirm} disabled={!newTitle.trim()}>
            Save
          </StyledButton>
        </div>
      </div>
    </Modal>
  );
}
