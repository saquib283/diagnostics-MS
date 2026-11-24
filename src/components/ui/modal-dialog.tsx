"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

/**
 * Native <dialog> modal adhering to modern-web-guidance `dialog`:
 * - Uses native showModal() / close() (browser handles inert background, top layer, Esc, focus restoration).
 * - Does NOT attach redundant role="dialog", aria-modal, or body overflow locks.
 */
export function ModalDialog({
  open,
  onClose,
  title,
  children,
  maxWidthClass = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      dialog.returnValue = "";
      onClose();
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={`w-[calc(100%-2rem)] ${maxWidthClass}`}
    >
      <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
        <h1 id={titleId} className="text-base font-semibold text-[#0F172A] m-0">
          {title}
        </h1>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Close dialog"
          className="inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  );
}

