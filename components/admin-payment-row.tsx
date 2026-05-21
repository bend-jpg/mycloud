"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { CreditCard, Bitcoin, Banknote, MoreVertical, Trash2, RefreshCcw, Check } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface Payment {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  notes: string | null;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  SUCCEEDED: "text-[var(--success)] bg-[var(--success)]/10",
  PENDING: "text-yellow-400 bg-yellow-400/10",
  FAILED: "text-[var(--danger)] bg-[var(--danger)]/10",
  REFUNDED: "text-violet-400 bg-violet-400/10",
};

const STATUS_LABEL: Record<string, string> = {
  SUCCEEDED: "Payé",
  PENDING: "En attente",
  FAILED: "Échoué",
  REFUNDED: "Remboursé",
};

export function AdminPaymentRow({ payment }: { payment: Payment }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(payment.status);
  const [notes, setNotes] = useState(payment.notes ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await fetch(`/api/admin/payments/${payment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes }),
    });
    setBusy(false);
    setEditing(false);
    setOpen(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm("Supprimer ce paiement ? (à n'utiliser que pour corriger une erreur)")) return;
    await fetch(`/api/admin/payments/${payment.id}`, { method: "DELETE" });
    router.refresh();
  }

  const MethodIcon = payment.method === "CRYPTO" ? Bitcoin : payment.method === "CASH" ? Banknote : CreditCard;

  return (
    <tr className="hover:bg-[var(--background-elevated)]">
      <td className="px-4 py-3 text-xs">{new Date(payment.createdAt).toLocaleString("fr")}</td>
      <td className="px-4 py-3">
        <Link href={`/admin/clients/${payment.userId}`} className="hover:text-[var(--accent)]">
          {payment.userName}
        </Link>
      </td>
      <td className="px-4 py-3 text-end font-semibold">{formatPrice(payment.amount, payment.currency as "EUR" | "USD")}</td>
      <td className="px-4 py-3 text-xs">
        <span className="inline-flex items-center gap-1"><MethodIcon className="size-3.5" /> {payment.method}</span>
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg bg-[var(--background-elevated)] border border-[var(--border)] px-2 py-1 text-xs">
            <option value="PENDING">En attente</option>
            <option value="SUCCEEDED">Payé</option>
            <option value="FAILED">Échoué</option>
            <option value="REFUNDED">Remboursé</option>
          </select>
        ) : (
          <span className={`text-xs rounded-full px-2 py-1 ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-[var(--foreground-muted)] max-w-xs truncate">
        {editing ? (
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded bg-[var(--background-elevated)] border border-[var(--border)] px-2 py-1" />
        ) : (
          payment.notes
        )}
      </td>
      <td className="px-2 text-end relative">
        {editing ? (
          <div className="flex gap-1">
            <button onClick={save} disabled={busy} className="p-1.5 rounded-lg text-[var(--success)] hover:bg-[var(--background-tile)]">
              <Check className="size-4" />
            </button>
            <button onClick={() => { setEditing(false); setStatus(payment.status); setNotes(payment.notes ?? ""); }} className="p-1.5 rounded-lg hover:bg-[var(--background-tile)] text-xs">×</button>
          </div>
        ) : (
          <button onClick={() => setOpen(!open)} className="p-1.5 rounded-lg hover:bg-[var(--background-tile)]">
            <MoreVertical className="size-4" />
          </button>
        )}
        {open && !editing && (
          <div className="absolute end-2 top-10 w-40 rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] p-1 shadow-2xl z-30">
            <button onClick={() => { setEditing(true); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-start">
              <RefreshCcw className="size-4" /> Changer statut
            </button>
            {payment.invoiceUrl && (
              <a href={payment.invoiceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)]">
                Voir facture Stripe
              </a>
            )}
            <button onClick={remove} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-[var(--danger)] text-start">
              <Trash2 className="size-4" /> Supprimer
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
