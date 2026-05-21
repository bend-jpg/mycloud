"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  CheckCheck,
  Trash2,
  ExternalLink,
  AlertTriangle,
  CreditCard,
  Download,
  Users,
  MessageCircle,
  HardDrive,
  Bell,
  Loader2,
} from "lucide-react";

type NotifType =
  | "QUOTA_WARNING"
  | "QUOTA_EXCEEDED"
  | "PAYMENT_FAILED"
  | "PAYMENT_SUCCEEDED"
  | "SHARE_DOWNLOADED"
  | "INVITE_ACCEPTED"
  | "INVITE_RECEIVED"
  | "TICKET_REPLY"
  | "ADMIN_ALERT"
  | "SYSTEM";

interface NotificationItem {
  id: string;
  type: NotifType;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const ICONS: Record<NotifType, React.ComponentType<{ className?: string }>> = {
  QUOTA_WARNING: HardDrive,
  QUOTA_EXCEEDED: AlertTriangle,
  PAYMENT_FAILED: CreditCard,
  PAYMENT_SUCCEEDED: CreditCard,
  SHARE_DOWNLOADED: Download,
  INVITE_ACCEPTED: Users,
  INVITE_RECEIVED: Users,
  TICKET_REPLY: MessageCircle,
  ADMIN_ALERT: AlertTriangle,
  SYSTEM: Bell,
};

const COLORS: Record<NotifType, string> = {
  QUOTA_WARNING: "text-yellow-400 bg-yellow-400/10",
  QUOTA_EXCEEDED: "text-[var(--danger)] bg-[var(--danger)]/10",
  PAYMENT_FAILED: "text-[var(--danger)] bg-[var(--danger)]/10",
  PAYMENT_SUCCEEDED: "text-[var(--success)] bg-[var(--success)]/10",
  SHARE_DOWNLOADED: "text-[var(--accent)] bg-[var(--accent)]/10",
  INVITE_ACCEPTED: "text-emerald-400 bg-emerald-400/10",
  INVITE_RECEIVED: "text-violet-400 bg-violet-400/10",
  TICKET_REPLY: "text-[var(--secondary)] bg-[var(--secondary)]/10",
  ADMIN_ALERT: "text-yellow-400 bg-yellow-400/10",
  SYSTEM: "text-[var(--foreground-muted)] bg-[var(--background-elevated)]",
};

export function NotificationsView({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Set<string>>(new Set());

  async function markAllRead() {
    setBusy(true);
    await fetch("/api/notifications", { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    router.refresh();
  }

  async function remove(id: string) {
    setRemoving((prev) => new Set(prev).add(id));
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    setRemoving((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="text-center text-[var(--foreground-muted)] py-16">
        <Bell className="size-12 mx-auto mb-3 opacity-30" />
        <p className="text-base">Aucune notification.</p>
        <p className="text-sm mt-1">
          Tu seras prévenu ici quand quelque chose se passe : téléchargement d&apos;un lien partagé,
          paiement, message d&apos;un admin, dépassement de quota…
        </p>
      </div>
    );
  }

  const hasUnread = items.some((n) => !n.read);

  return (
    <>
      {hasUnread && (
        <div className="flex justify-end">
          <button onClick={markAllRead} disabled={busy} className="btn-ghost text-xs">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}
            Tout marquer comme lu
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((n) => {
          const Icon = ICONS[n.type] ?? Bell;
          const colorClass = COLORS[n.type] ?? COLORS.SYSTEM;
          const isRemoving = removing.has(n.id);
          return (
            <li
              key={n.id}
              className={`rounded-2xl border p-4 flex items-start gap-3 transition-opacity ${
                isRemoving ? "opacity-30 pointer-events-none" : ""
              } ${
                n.read
                  ? "border-[var(--border)] bg-[var(--background-tile)]"
                  : "border-[var(--accent)]/30 bg-[var(--accent)]/5"
              }`}
            >
              <div className={`shrink-0 size-10 rounded-xl flex items-center justify-center ${colorClass}`}>
                <Icon className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm">
                    {n.title}
                    {!n.read && (
                      <span className="inline-block ms-2 align-middle size-1.5 rounded-full bg-[var(--accent)]" />
                    )}
                  </p>
                  <span className="text-xs text-[var(--foreground-muted)] shrink-0">
                    {relativeTime(n.createdAt)}
                  </span>
                </div>
                {n.body && (
                  <p className="text-sm text-[var(--foreground-muted)] mt-1 break-words">{n.body}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {n.link && (
                    <Link
                      href={n.link}
                      onClick={() => !n.read && markRead(n.id)}
                      className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="size-3" />
                      Voir
                    </Link>
                  )}
                  {!n.read && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                    >
                      Marquer lu
                    </button>
                  )}
                  <button
                    onClick={() => remove(n.id)}
                    className="text-xs text-[var(--foreground-muted)] hover:text-[var(--danger)] ms-auto flex items-center gap-1"
                  >
                    <Trash2 className="size-3" />
                    Effacer
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `il y a ${days}j`;
  return d.toLocaleDateString();
}
