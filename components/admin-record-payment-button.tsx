"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";

export function RecordPaymentButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"EUR" | "USD">("EUR");
  const [method, setMethod] = useState<"CASH" | "BANK_TRANSFER" | "CRYPTO" | "OTHER">("CASH");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(parseFloat(amount) * 100);
    if (isNaN(cents) || cents <= 0) return;
    setBusy(true);
    const res = await fetch(`/api/admin/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, amount: cents, currency, method, notes: notes || null }),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setAmount("");
      setNotes("");
      router.refresh();
    } else {
      alert("Erreur");
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost text-xs">
        <Plus className="size-3.5" />
        Saisir paiement
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[var(--background-elevated)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <h2 className="font-semibold">Saisir un paiement manuel</h2>
              <button onClick={() => setOpen(false)}>
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Montant</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Devise</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as "EUR" | "USD")}
                    className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Méthode</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as typeof method)}
                  className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                >
                  <option value="CASH">Espèces</option>
                  <option value="BANK_TRANSFER">Virement</option>
                  <option value="CRYPTO">Crypto (hors Coinbase)</option>
                  <option value="OTHER">Autre</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Note (optionnel)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex : reçu en main propre"
                  className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                />
              </div>
              <button type="submit" disabled={busy} className="btn-primary w-full justify-center disabled:opacity-50">
                {busy && <Loader2 className="size-4 animate-spin" />}
                Enregistrer
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
