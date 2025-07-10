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
  size?: "md" | "sm";
  position?: "top" | "center";
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  position = "top",
}: ModalProps) {
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

  const containerClasses = clsx(
    "fixed inset-0 z-50 flex justify-center p-4 transition-opacity",
    {
      "items-start pt-20": position === "top",
      "items-center": position === "center",
    }
  );

  const modalClasses = clsx(
    "bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full flex flex-col",
    {
      "max-w-2xl max-h-[80vh]": size === "md",
      "max-w-md": size === "sm",
    }
  );

  return (
    <div
      className={containerClasses}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div className={modalClasses} onClick={(e) => e.stopPropagation()}>
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
  );
}
