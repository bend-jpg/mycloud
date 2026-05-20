"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Plus, Loader2, X, MessageSquare } from "lucide-react";

interface TicketRow {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  updatedAt: string;
  messagesCount: number;
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Ouvert",
  IN_PROGRESS: "En cours",
  WAITING_USER: "Ta réponse attendue",
  RESOLVED: "Résolu",
  CLOSED: "Fermé",
};

const STATUS_COLOR: Record<string, string> = {
  OPEN: "text-yellow-400 bg-yellow-400/10",
  IN_PROGRESS: "text-[var(--accent)] bg-[var(--accent)]/10",
  WAITING_USER: "text-violet-400 bg-violet-400/10",
  RESOLVED: "text-[var(--success)] bg-[var(--success)]/10",
  CLOSED: "text-[var(--foreground-muted)] bg-[var(--background-elevated)]",
};

export function TicketsClientPanel({
  locale,
  tickets,
}: {
  locale: string;
  tickets: TicketRow[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body, priority }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.message ?? data.error ?? "Erreur");
      return;
    }
    setShowForm(false);
    setSubject("");
    setBody("");
    router.refresh();
    router.push(`/support/${data.ticket.id}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Mes tickets ({tickets.length})</h2>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
            <Plus className="size-4" /> Nouveau ticket
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="tile cursor-default !min-h-0 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Nouveau ticket</h3>
            <button type="button" onClick={() => setShowForm(false)}>
              <X className="size-4" />
            </button>
          </div>
          <div>
            <label className="text-xs text-[var(--foreground-muted)] mb-1 block">Sujet</label>
            <input
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={140}
              className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--foreground-muted)] mb-1 block">Message</label>
            <textarea
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              maxLength={4000}
              className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm resize-y"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--foreground-muted)] mb-1 block">Priorité</label>
            <div className="grid grid-cols-4 gap-2">
              {(["LOW", "NORMAL", "HIGH", "URGENT"] as const).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`rounded-lg py-2 text-xs transition-colors border ${
                    priority === p
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--border)]"
                  }`}
                >
                  {p === "LOW" ? "Basse" : p === "NORMAL" ? "Normale" : p === "HIGH" ? "Haute" : "Urgente"}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button type="submit" disabled={busy || !subject || !body} className="btn-primary w-full justify-center disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4" />}
            Envoyer le ticket
          </button>
        </form>
      )}

      {tickets.length === 0 && !showForm ? (
        <div className="tile cursor-default !min-h-0 text-center text-sm text-[var(--foreground-muted)] py-8">
          Aucun ticket pour l&apos;instant. Si tu as une question, n&apos;hésite pas !
        </div>
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/support/${t.id}`}
                className="tile cursor-pointer hover:scale-[1.01] !min-h-0 !p-4 flex items-center gap-3 flex-col sm:flex-row !items-start sm:!items-center"
              >
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-xs text-[var(--foreground-muted)]">#{t.number}</code>
                    <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_COLOR[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  </div>
                  <p className="font-medium truncate">{t.subject}</p>
                  <p className="text-xs text-[var(--foreground-muted)] mt-1">
                    {t.messagesCount} message{t.messagesCount > 1 ? "s" : ""} · MAJ{" "}
                    {new Date(t.updatedAt).toLocaleDateString(locale)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
