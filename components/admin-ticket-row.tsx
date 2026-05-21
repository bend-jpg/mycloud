"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { MoreVertical, Trash2, Eye } from "lucide-react";

interface Ticket {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  updatedAt: string;
  openedBy: { id: string; name: string | null; email: string };
  messagesCount: number;
}

const STATUS_COLOR: Record<string, string> = {
  OPEN: "text-yellow-400 bg-yellow-400/10",
  IN_PROGRESS: "text-[var(--accent)] bg-[var(--accent)]/10",
  WAITING_USER: "text-violet-400 bg-violet-400/10",
  RESOLVED: "text-[var(--success)] bg-[var(--success)]/10",
  CLOSED: "text-[var(--foreground-muted)] bg-[var(--background-elevated)]",
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "text-[var(--foreground-muted)]",
  NORMAL: "text-[var(--foreground)]",
  HIGH: "text-yellow-400",
  URGENT: "text-[var(--danger)]",
};

export function AdminTicketRow({ ticket, locale }: { ticket: Ticket; locale: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function remove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Supprimer le ticket #${ticket.number} ? Cette action est irréversible.`)) return;
    await fetch(`/api/admin/tickets/${ticket.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <tr className="hover:bg-[var(--background-elevated)]">
      <td className="px-4 py-3 font-mono text-xs">
        <Link href={`/admin/tickets/${ticket.id}`} className="hover:text-[var(--accent)]">#{ticket.number}</Link>
      </td>
      <td className="px-4 py-3 font-medium">
        <Link href={`/admin/tickets/${ticket.id}`} className="hover:text-[var(--accent)]">{ticket.subject}</Link>
        <span className="text-xs text-[var(--foreground-muted)] ms-2">({ticket.messagesCount} msg)</span>
      </td>
      <td className="px-4 py-3 text-xs">
        <Link href={`/admin/clients/${ticket.openedBy.id}`} className="hover:text-[var(--accent)]">
          {ticket.openedBy.name ?? ticket.openedBy.email}
        </Link>
      </td>
      <td className="px-4 py-3 text-xs"><span className={PRIORITY_COLOR[ticket.priority]}>{ticket.priority}</span></td>
      <td className="px-4 py-3"><span className={`text-xs rounded-full px-2 py-1 ${STATUS_COLOR[ticket.status]}`}>{ticket.status}</span></td>
      <td className="px-4 py-3 text-end text-xs text-[var(--foreground-muted)]">{new Date(ticket.updatedAt).toLocaleDateString(locale)}</td>
      <td className="px-2 text-end relative">
        <button onClick={() => setOpen(!open)} className="p-1.5 rounded-lg hover:bg-[var(--background-tile)]">
          <MoreVertical className="size-4" />
        </button>
        {open && (
          <div className="absolute end-2 top-10 w-40 rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] p-1 shadow-2xl z-30">
            <Link href={`/admin/tickets/${ticket.id}`} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)]">
              <Eye className="size-4" /> Voir
            </Link>
            <button onClick={remove} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-[var(--danger)] text-start">
              <Trash2 className="size-4" /> Supprimer
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
