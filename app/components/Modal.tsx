// app/components/Modal.tsx
"use client";

import React, {ReactNode, useEffect} from "react";
import {X} from "lucide-react";
import clsx from "clsx";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  position?: "center" | "top"; // New prop for positioning
  size?: "sm" | "md" | "lg"; // New prop for width
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title = "",
  children,
  position = "center",
  size = "md",
}) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
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

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
  };

  return (
    // --- THIS IS THE FIX: The background is now a separate div, and vertical alignment is dynamic ---
    <div
      className={clsx(
        "fixed inset-0 z-50 flex p-4 justify-center",
        position === "center" ? "items-center" : "items-start pt-20"
      )}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div
        className={clsx(
          "relative z-10 w-full flex flex-col bg-[var(--card-bg)] text-[var(--text-primary)] rounded-2xl shadow-xl",
          sizeClasses[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
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
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
    // --- END FIX ---
  );
};

export default Modal;
