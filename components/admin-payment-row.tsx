"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { CreditCard, Bitcoin, Banknote, Trash2, ExternalLink, Loader2, Pencil } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { PromptDialog } from "./prompt-dialog";
import { ConfirmDialog } from "./confirm-dialog";

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
  const [statusOpen, setStatusOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function changeStatus(newStatus: string) {
    if (newStatus === payment.status) {
      setStatusOpen(false);
      return;
    }
    setBusy(true);
    await fetch(`/api/admin/payments/${payment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setBusy(false);
    setStatusOpen(false);
    router.refresh();
  }

  function openNotes() {
    setNotesOpen(true);
  }

  async function submitNotes(newNotes: string) {
    setBusy(true);
    await fetch(`/api/admin/payments/${payment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: newNotes }),
    });
    setBusy(false);
    setNotesOpen(false);
    router.refresh();
  }

  function askRemove() {
    setConfirmRemove(true);
  }

  async function performRemove() {
    setBusy(true);
    await fetch(`/api/admin/payments/${payment.id}`, { method: "DELETE" });
    setBusy(false);
    setConfirmRemove(false);
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
        {/* Clic sur le badge de statut → ouvre le dropdown */}
        <div ref={statusRef} className="relative inline-block">
          <button
            onClick={() => setStatusOpen((v) => !v)}
            disabled={busy}
            className={`text-xs rounded-full px-2 py-1 inline-flex items-center gap-1 hover:opacity-80 ${STATUS_COLOR[payment.status]}`}
            title="Cliquer pour changer le statut"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : null}
            {STATUS_LABEL[payment.status]}
          </button>
          {statusOpen && (
            <div className="absolute start-0 top-full mt-1 w-36 rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] p-1 shadow-2xl z-30">
              {(["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  className={`w-full text-start text-xs rounded-lg px-3 py-1.5 ${
                    payment.status === s
                      ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "hover:bg-[var(--background-tile)]"
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-[var(--foreground-muted)] max-w-xs truncate">
        {payment.notes ?? "—"}
      </td>
      <td className="px-2 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={openNotes}
            className="p-1.5 rounded-lg hover:bg-[var(--background-tile)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            title="Modifier les notes"
          >
            <Pencil className="size-4" />
          </button>
          {payment.invoiceUrl && (
            <a
              href={payment.invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-[var(--background-tile)] text-[var(--foreground-muted)] hover:text-[var(--accent)]"
              title="Voir facture Stripe"
            >
              <ExternalLink className="size-4" />
            </a>
          )}
          <button
            onClick={askRemove}
            className="p-1.5 rounded-lg hover:bg-[var(--danger)]/10 text-[var(--foreground-muted)] hover:text-[var(--danger)]"
            title="Supprimer le paiement"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </td>

      <PromptDialog
        open={notesOpen}
        title="Modifier les notes du paiement"
        defaultValue={payment.notes ?? ""}
        placeholder="Note interne…"
        submitLabel="Enregistrer"
        onClose={() => setNotesOpen(false)}
        onSubmit={submitNotes}
      />

      <ConfirmDialog
        open={confirmRemove}
        title="Supprimer ce paiement ?"
        message="À n'utiliser que pour corriger une erreur de saisie. Le paiement sera retiré définitivement."
        confirmLabel="Supprimer"
        destructive
        onClose={() => setConfirmRemove(false)}
        onConfirm={performRemove}
      />
    </tr>
  );
}
