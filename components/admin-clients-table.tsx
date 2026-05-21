"use client";

// Wrapper client autour du tableau /admin/clients :
//   - sélection multiple via checkbox (passée en slot au AdminClientRow)
//   - barre d'action bulk quand des items sont sélectionnés
//   - actions : notification, message (ticket), email broadcast, suspendre

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Mail, Bell, Ban, Loader2, Sparkles, MessageSquare } from "lucide-react";
import { AdminClientRow } from "./admin-client-row";

interface PlanLite {
  slug: string;
  name: string;
}

interface ClientLite {
  id: string;
  name: string | null;
  email: string;
  planSlug: string | null;
  planName: string | null;
  storageUsed: string;
  storageQuota: string;
  createdAt: string;
  suspendedAt: string | null;
  role: string;
}

type BulkAction = "notify" | "message" | "email";

export function AdminClientsTable({
  users,
  allPlans,
  locale,
  emailConfigured,
}: {
  users: ClientLite[];
  allPlans: PlanLite[];
  locale: string;
  emailConfigured: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (selected.size === users.length) setSelected(new Set());
    else setSelected(new Set(users.map((u) => u.id)));
  }
  function clear() {
    setSelected(new Set());
  }

  async function bulkSuspend(suspend: boolean) {
    if (selected.size === 0) return;
    const action = suspend ? "suspendre" : "réactiver";
    if (!confirm(`Vraiment ${action} ${selected.size} client(s) ?`)) return;
    setBusy(true);
    await fetch("/api/admin/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "suspend", userIds: Array.from(selected), suspend }),
    });
    setBusy(false);
    clear();
    router.refresh();
  }

  const allChecked = selected.size === users.length && users.length > 0;

  return (
    <>
      {selected.size > 0 && (
        <div className="sticky top-4 z-30 flex items-center justify-between gap-3 rounded-2xl border border-[var(--accent)]/30 bg-[var(--background-elevated)] p-3 shadow-2xl">
          <p className="text-sm font-medium">
            <Sparkles className="size-3.5 inline text-[var(--accent)] me-1" />
            {selected.size} client(s) sélectionné(s)
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setBulkAction("notify")} className="btn-ghost text-xs">
              <Bell className="size-3.5" />
              Notification
            </button>
            <button onClick={() => setBulkAction("message")} className="btn-ghost text-xs">
              <MessageSquare className="size-3.5" />
              Message
            </button>
            {emailConfigured && (
              <button onClick={() => setBulkAction("email")} className="btn-ghost text-xs">
                <Mail className="size-3.5" />
                Email
              </button>
            )}
            <button
              onClick={() => bulkSuspend(true)}
              disabled={busy}
              className="btn-ghost text-xs !text-[var(--danger)]"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />}
              Suspendre
            </button>
            <button onClick={() => bulkSuspend(false)} disabled={busy} className="btn-ghost text-xs">
              Réactiver
            </button>
            <button onClick={clear} className="btn-ghost text-xs">
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--background-elevated)] text-[var(--foreground-muted)] text-xs uppercase">
            <tr>
              <th className="w-8 px-2 py-3">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="accent-[var(--accent)]"
                  aria-label="Tout sélectionner"
                />
              </th>
              <th className="text-start px-4 py-3">Client</th>
              <th className="text-start px-4 py-3">Plan</th>
              <th className="text-end px-4 py-3">Stockage</th>
              <th className="text-start px-4 py-3">Inscrit le</th>
              <th className="text-start px-4 py-3">Statut</th>
              <th className="w-10 px-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {users.map((u) => (
              <AdminClientRow
                key={u.id}
                user={u}
                allPlans={allPlans}
                locale={locale}
                selectionCheckbox={
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggleOne(u.id)}
                    className="accent-[var(--accent)]"
                    aria-label="Sélectionner"
                  />
                }
              />
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="text-center text-sm text-[var(--foreground-muted)] py-12">
            Aucun client trouvé.
          </div>
        )}
      </div>

      {bulkAction && (
        <BulkActionModal
          action={bulkAction}
          userIds={Array.from(selected)}
          onClose={() => setBulkAction(null)}
          onDone={() => {
            setBulkAction(null);
            clear();
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function BulkActionModal({
  action,
  userIds,
  onClose,
  onDone,
}: {
  action: BulkAction;
  userIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const payload: Record<string, unknown> = { action, userIds };
    if (action === "notify") {
      payload.title = title;
      payload.body = body;
      if (link) payload.link = link;
    } else if (action === "message") {
      payload.subject = title;
      payload.message = body;
    } else if (action === "email") {
      payload.subject = title;
      payload.html = body;
    }
    const res = await fetch("/api/admin/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErr(data?.message ?? data?.error ?? "Erreur");
      return;
    }
    const data = await res.json();
    if (action === "email" && data.failed > 0) {
      alert(`Email envoyé à ${data.sent}, échec : ${data.failed}`);
    }
    onDone();
  }

  const labels = {
    notify: {
      title: "Notification push",
      subjectLabel: "Titre",
      bodyLabel: "Description (optionnel)",
      desc: "Apparaîtra dans la cloche de notification de chaque client.",
    },
    message: {
      title: "Message — ouvre un ticket",
      subjectLabel: "Sujet",
      bodyLabel: "Message",
      desc: "Crée un ticket avec ton message comme première réponse. Le client peut répondre.",
    },
    email: {
      title: "Email broadcast",
      subjectLabel: "Sujet de l'email",
      bodyLabel: "Contenu HTML (placeholders {{name}} et {{email}} acceptés)",
      desc: "Envoie un email à chaque client via Resend.",
    },
  } as const;

  const cfg = labels[action];

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-auto"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--background-elevated)] border border-[var(--border)] rounded-2xl w-full max-w-lg my-8 shadow-2xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div>
            <h2 className="font-semibold">{cfg.title}</h2>
            <p className="text-xs text-[var(--foreground-muted)] mt-1">
              {userIds.length} destinataire(s) · {cfg.desc}
            </p>
          </div>
          <button type="button" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">{cfg.subjectLabel}</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{cfg.bodyLabel}</label>
            <textarea
              required={action !== "notify"}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={action === "email" ? 10 : 5}
              className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm font-mono"
              placeholder={
                action === "email"
                  ? "<p>Bonjour {{name}},</p>\n<p>...</p>"
                  : "Bonjour, ..."
              }
            />
          </div>
          {action === "notify" && (
            <div>
              <label className="text-sm font-medium mb-1 block">Lien (optionnel)</label>
              <input
                type="text"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="/billing"
                className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
              />
              <p className="text-[10px] text-[var(--foreground-muted)] mt-1">
                Le client est redirigé vers ce chemin en cliquant la notif.
              </p>
            </div>
          )}
          {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full justify-center disabled:opacity-50">
            {busy && <Loader2 className="size-4 animate-spin" />}
            Envoyer à {userIds.length} client(s)
          </button>
        </div>
      </form>
    </div>
  );
}
