"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Lock, CheckCircle2, MessageSquare } from "lucide-react";

interface Author {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface Message {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author: Author;
}

export interface TicketData {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  openedBy: { id: string; name: string | null; email: string };
  messages: Message[];
}

const STATUS_COLOR: Record<string, string> = {
  OPEN: "text-yellow-400 bg-yellow-400/10",
  IN_PROGRESS: "text-[var(--accent)] bg-[var(--accent)]/10",
  WAITING_USER: "text-violet-400 bg-violet-400/10",
  RESOLVED: "text-[var(--success)] bg-[var(--success)]/10",
  CLOSED: "text-[var(--foreground-muted)] bg-[var(--background-elevated)]",
};

export function TicketThread({
  ticket,
  isAdminView,
  currentUserId,
}: {
  ticket: TicketData;
  isAdminView: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/tickets/${ticket.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply, isInternal }),
    });
    setBusy(false);
    if (res.ok) {
      setReply("");
      setIsInternal(false);
      router.refresh();
    } else {
      alert("Erreur d'envoi");
    }
  }

  async function changeStatus(status: string) {
    if (!isAdminView) return;
    await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  return (
    <>
      <div className="tile cursor-default !min-h-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <code className="text-xs text-[var(--foreground-muted)]">#{ticket.number}</code>
              <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_COLOR[ticket.status]}`}>
                {ticket.status}
              </span>
              <span className="text-xs text-[var(--foreground-muted)]">{ticket.priority}</span>
            </div>
            <h1 className="text-xl font-bold">{ticket.subject}</h1>
            {isAdminView && (
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                Ouvert par {ticket.openedBy.name ?? ticket.openedBy.email}
              </p>
            )}
          </div>
          {isAdminView && ticket.status !== "RESOLVED" && (
            <div className="flex gap-2">
              <button
                onClick={() => changeStatus("RESOLVED")}
                className="btn-primary text-xs"
              >
                <CheckCircle2 className="size-3.5" />
                Marquer résolu
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <ul className="space-y-3 mt-4">
        {ticket.messages.map((m) => {
          const isOwn = m.author.id === currentUserId;
          const isStaff = m.author.role !== "USER";
          return (
            <li
              key={m.id}
              className={`tile cursor-default !min-h-0 ${
                m.isInternal ? "border-yellow-400/40 bg-yellow-400/5" : ""
              } ${isOwn ? "border-[var(--accent)]/30" : ""}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-full bg-[var(--background-elevated)] flex items-center justify-center text-xs font-semibold">
                    {(m.author.name ?? m.author.email).charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">
                    {m.author.name ?? m.author.email}
                  </span>
                  {isStaff && (
                    <span className="text-xs rounded-full bg-[var(--accent)]/20 text-[var(--accent)] px-2 py-0.5">
                      Équipe MyTitanCloud
                    </span>
                  )}
                  {m.isInternal && (
                    <span className="text-xs text-yellow-400 flex items-center gap-1">
                      <Lock className="size-3" />
                      Note interne
                    </span>
                  )}
                </div>
                <span className="text-xs text-[var(--foreground-muted)]">
                  {new Date(m.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{m.body}</p>
            </li>
          );
        })}
      </ul>

      {/* Reply form */}
      {ticket.status !== "CLOSED" && (
        <form onSubmit={send} className="tile cursor-default !min-h-0 mt-4 space-y-3">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder={isInternal ? "Note interne (invisible pour le client)" : "Ta réponse…"}
            className={`w-full rounded-xl border px-3 py-2 text-sm resize-y ${
              isInternal
                ? "bg-yellow-400/5 border-yellow-400/40"
                : "bg-[var(--background)] border-[var(--border)]"
            }`}
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {isAdminView ? (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="accent-yellow-400"
                />
                Note interne (privée)
              </label>
            ) : (
              <span />
            )}
            <button type="submit" disabled={busy || !reply.trim()} className="btn-primary text-sm disabled:opacity-50">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {isInternal ? "Ajouter la note" : "Envoyer"}
            </button>
          </div>
        </form>
      )}

      {ticket.status === "CLOSED" && (
        <div className="tile cursor-default !min-h-0 mt-4 text-center text-sm text-[var(--foreground-muted)]">
          <MessageSquare className="size-5 mx-auto mb-2 opacity-50" />
          Ce ticket est fermé. Crée un nouveau ticket si tu as une autre question.
        </div>
      )}
    </>
  );
}
