"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Initial {
  kind: string;
  notes: string | null;
  createdAt: Date;
}

export function HostingWaitlistForm({
  kind,
  initial,
  icon: Icon,
  color,
  title,
  subtitle,
  features,
}: {
  kind: "site" | "claude-code";
  initial: Initial | null;
  icon: LucideIcon;
  color: "emerald" | "violet";
  title: string;
  subtitle: string;
  features: { icon: LucideIcon; label: string }[];
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState(!!initial);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/hosting/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, notes: notes.trim() || undefined }),
    });
    setBusy(false);
    if (res.ok) {
      setRegistered(true);
      router.refresh();
    }
  }

  async function unregister() {
    if (!confirm("Te retirer de la liste d'attente ?")) return;
    setBusy(true);
    await fetch(`/api/hosting/waitlist?kind=${kind}`, { method: "DELETE" });
    setBusy(false);
    setRegistered(false);
    setNotes("");
    router.refresh();
  }

  const accentClasses = {
    emerald: { bg: "bg-emerald-500/15", border: "border-emerald-500/30", text: "text-emerald-400" },
    violet: { bg: "bg-violet-500/15", border: "border-violet-500/30", text: "text-violet-400" },
  };
  const a = accentClasses[color];

  return (
    <div className={`rounded-2xl border ${a.border} bg-[var(--background-tile)] p-6 flex flex-col`}>
      <div className={`size-12 rounded-2xl ${a.bg} ${a.text} flex items-center justify-center mb-4`}>
        <Icon className="size-6" />
      </div>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="text-sm text-[var(--foreground-muted)] mt-1">{subtitle}</p>

      <ul className="space-y-2 mt-4 mb-4">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <f.icon className={`size-4 mt-0.5 ${a.text} shrink-0`} />
            <span>{f.label}</span>
          </li>
        ))}
      </ul>

      {registered ? (
        <div className="mt-auto rounded-xl border border-[var(--success)]/30 bg-[var(--success)]/5 p-4">
          <p className="text-sm font-medium text-[var(--success)] flex items-center gap-2">
            <Check className="size-4" /> Tu es sur la liste !
          </p>
          {notes && (
            <p className="text-xs text-[var(--foreground-muted)] mt-2 italic">
              « {notes} »
            </p>
          )}
          <button
            onClick={unregister}
            disabled={busy}
            className="mt-3 text-xs text-[var(--foreground-muted)] hover:text-[var(--danger)] flex items-center gap-1"
          >
            <X className="size-3" /> Me retirer
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-auto space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={
              kind === "site"
                ? "Que veux-tu héberger ? (portfolio, blog, app SaaS…)"
                : "À quoi vas-tu utiliser Claude Code ? (script, app, side-project…)"
            }
            className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
          />
          <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
            {busy && <Loader2 className="size-4 animate-spin" />}
            Pré-inscription
          </button>
        </form>
      )}
    </div>
  );
}
