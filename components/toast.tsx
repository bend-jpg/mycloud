"use client";

// Système de toast minimaliste sans dépendance externe.
// Usage :
//   const { toast } = useToast();
//   toast.success("Sauvegardé");
//   toast.error("Erreur réseau");
//   toast.info("Lien copié");

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
    warning: (msg: string) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback no-op si pas de provider — évite de planter
    return {
      toast: {
        success: (m) => console.log("[toast.success]", m),
        error: (m) => console.warn("[toast.error]", m),
        info: (m) => console.log("[toast.info]", m),
        warning: (m) => console.warn("[toast.warning]", m),
      },
    };
  }
  return ctx;
}

const KIND_META: Record<ToastKind, { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  success: { icon: CheckCircle2, cls: "bg-[var(--success)]/10 border-[var(--success)]/30 text-[var(--success)]" },
  error: { icon: AlertTriangle, cls: "bg-[var(--danger)]/10 border-[var(--danger)]/30 text-[var(--danger)]" },
  warning: { icon: AlertTriangle, cls: "bg-yellow-400/10 border-yellow-400/30 text-yellow-400" },
  info: { icon: Info, cls: "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { id, kind, message }]);
    // Auto-dismiss après 4s
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const value: ToastContextValue = {
    toast: {
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
      warning: (m) => push("warning", m),
    },
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed top-4 end-4 z-[300] flex flex-col gap-2 pointer-events-none w-full max-w-sm">
            {items.map((t) => {
              const meta = KIND_META[t.kind];
              const Icon = meta.icon;
              return (
                <div
                  key={t.id}
                  className={`pointer-events-auto rounded-2xl border backdrop-blur-md bg-[var(--background-elevated)]/95 shadow-2xl p-3.5 flex items-start gap-3 animate-slide-down ${meta.cls}`}
                  role="status"
                  aria-live="polite"
                >
                  <Icon className="size-5 shrink-0 mt-0.5" />
                  <p className="flex-1 text-sm text-[var(--foreground)] min-w-0 break-words">{t.message}</p>
                  <button
                    onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
                    aria-label="Fermer"
                    className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] shrink-0"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
