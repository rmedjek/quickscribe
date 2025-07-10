// app/components/modals/DeleteConfirmationModal.tsx
"use client";

import Modal from "../Modal";
import StyledButton from "../StyledButton";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" position="center">
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
          <StyledButton variant="danger" onClick={onConfirm}>
            Delete
          </StyledButton>
          <StyledButton variant="secondary" onClick={onClose}>
            Cancel
          </StyledButton>
        </div>
      </div>
    </Modal>
  );
}
