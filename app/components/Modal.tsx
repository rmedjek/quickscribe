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
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 transition-opacity"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      {/* --- THIS IS THE FIX for the Modal Container --- */}
      <div
        className="bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
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
        {/* Modal Body */}
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
      {/* --- END FIX --- */}
    </div>
  );
};

export default Modal;
