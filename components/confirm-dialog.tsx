"use client";

// Modal de confirmation pour remplacer window.confirm() — bouton OK
// par défaut en couleur d'accent, en rouge si destructive=true.
// Esc / clic-outside = annuler. Enter = confirmer.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2 } from "lucide-react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Corps du message — peut être un string ou un ReactNode pour du markup */
  message?: React.ReactNode;
  /** Libellé du bouton de confirmation (défaut: "Confirmer") */
  confirmLabel?: string;
  /** Libellé du bouton d'annulation (défaut: "Annuler") */
  cancelLabel?: string;
  /** Bouton confirmer en rouge */
  destructive?: boolean;
  onClose: () => void;
  /** Peut être async — bouton en busy pendant l'attente */
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  destructive = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setBusy(false);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && !busy) {
        e.preventDefault();
        handleConfirm();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="alertdialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[var(--background-elevated)] border border-[var(--border)] rounded-3xl shadow-2xl overflow-hidden animate-slide-down"
      >
        <div className="p-5 flex gap-4">
          {destructive && (
            <div className="size-10 rounded-full bg-[var(--danger)]/15 border border-[var(--danger)]/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="size-5 text-[var(--danger)]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-tight">{title}</h2>
            {message && (
              <div className="text-sm text-[var(--foreground-muted)] mt-2">{message}</div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border)] bg-[var(--background)]/40">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="btn-ghost text-sm"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            autoFocus
            className={
              destructive
                ? "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold bg-[var(--danger)] text-white hover:opacity-90 disabled:opacity-50"
                : "btn-primary text-sm"
            }
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
