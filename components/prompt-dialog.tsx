"use client";

// Modal léger pour remplacer window.prompt() — input + valide/annule,
// keyboard support (Enter = submit, Esc = close), focus auto sur l'input,
// rendu via Portal en z-200.
//
// Usage (controlled) :
//   const [open, setOpen] = useState(false);
//   <PromptDialog
//     open={open}
//     title="Renommer le fichier"
//     defaultValue={file.name}
//     onClose={() => setOpen(false)}
//     onSubmit={async (val) => { await rename(val); setOpen(false); }}
//   />

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";

export interface PromptDialogProps {
  open: boolean;
  title: string;
  /** Texte d'aide affiché sous l'input */
  hint?: string;
  /** Valeur initiale du champ */
  defaultValue?: string;
  /** Placeholder du champ */
  placeholder?: string;
  /** Label du bouton de validation (défaut: "Valider") */
  submitLabel?: string;
  /** Si fourni, valide la valeur. Retourner string = message d'erreur, null/undefined = ok */
  validate?: (value: string) => string | null | undefined;
  /** Si true, le bouton submit est rouge (action destructive) */
  destructive?: boolean;
  onClose: () => void;
  /** Peut être async ; pendant l'attente le bouton est en busy */
  onSubmit: (value: string) => void | Promise<void>;
}

export function PromptDialog({
  open,
  title,
  hint,
  defaultValue = "",
  placeholder,
  submitLabel = "Valider",
  validate,
  destructive = false,
  onClose,
  onSubmit,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  // Reset à l'ouverture
  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setError(null);
      setBusy(false);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [open, defaultValue]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Champ vide");
      return;
    }
    if (validate) {
      const err = validate(trimmed);
      if (err) {
        setError(err);
        return;
      }
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[var(--background-elevated)] border border-[var(--border)] rounded-3xl shadow-2xl overflow-hidden animate-slide-down"
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-[var(--background-tile)] text-[var(--foreground-muted)]"
            title="Fermer"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 pb-3 space-y-2">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder={placeholder}
            className={`w-full bg-[var(--background)] border ${
              error ? "border-[var(--danger)]" : "border-[var(--border)]"
            } rounded-xl px-3 py-2.5 text-base outline-none focus:border-[var(--accent)]`}
            disabled={busy}
          />
          {hint && !error && (
            <p className="text-xs text-[var(--foreground-muted)]">{hint}</p>
          )}
          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border)] bg-[var(--background)]/40">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="btn-ghost text-sm"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={busy}
            className={
              destructive
                ? "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold bg-[var(--danger)] text-white hover:opacity-90 disabled:opacity-50"
                : "btn-primary text-sm"
            }
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {submitLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
