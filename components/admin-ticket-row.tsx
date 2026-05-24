"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Trash2, Eye } from "lucide-react";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "./toast";

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
  const { toast } = useToast();
  const [confirmDel, setConfirmDel] = useState(false);

  function askDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmDel(true);
  }

  async function performDelete() {
    const res = await fetch(`/api/admin/tickets/${ticket.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(`Ticket #${ticket.number} supprimé`);
      router.refresh();
    } else {
      toast.error("Échec de la suppression");
    }
    setConfirmDel(false);
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
      <td className="px-2 py-3">
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/admin/tickets/${ticket.id}`}
            className="p-1.5 rounded-lg hover:bg-[var(--background-tile)] text-[var(--foreground-muted)] hover:text-[var(--accent)]"
            title="Voir le ticket"
          >
            <Eye className="size-4" />
          </Link>
          <button
            onClick={askDelete}
            className="p-1.5 rounded-lg hover:bg-[var(--danger)]/10 text-[var(--foreground-muted)] hover:text-[var(--danger)]"
            title="Supprimer le ticket"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </td>

      <ConfirmDialog
        open={confirmDel}
        title={`Supprimer le ticket #${ticket.number} ?`}
        message={
          <>
            Le sujet <strong>{ticket.subject}</strong> et tous ses messages seront effacés
            définitivement. Action irréversible.
          </>
        }
        confirmLabel="Supprimer"
        destructive
        onClose={() => setConfirmDel(false)}
        onConfirm={performDelete}
      />
    </tr>
  );
}
