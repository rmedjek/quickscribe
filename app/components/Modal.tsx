// app/components/Modal.tsx
"use client";

import React, {ReactNode, useEffect} from "react";
import {X} from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const Modal: React.FC<ModalProps> = ({isOpen, onClose, title, children}) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      // The background overlay is now gone
      className="fixed inset-0 z-50 flex justify-center items-start pt-20"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* The header is now conditional, allowing it to be hidden */}
        {title && (
          <div className="flex justify-between items-center p-4 border-b border-[var(--border-color)] flex-shrink-0">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-[var(--text-secondary)] hover:bg-slate-500/10"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        )}
        {/* The body no longer has default padding */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
