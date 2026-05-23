"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, Tag, Power, Trash2, Sparkles, Calendar, Users as UsersIcon } from "lucide-react";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "./toast";

interface CouponItem {
  id: string;
  code: string;
  active: boolean;
  timesRedeemed: number;
  maxRedemptions: number | null;
  expiresAt: string | null;
  createdAt: string;
  coupon: {
    percentOff: number | null;
    amountOff: number | null;
    currency: string | null;
    duration: string;
    durationInMonths: number | null;
    valid: boolean;
  };
}

export function CouponsView({ items }: { items: CouponItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState<{ id: string; code: string } | null>(null);

  async function performDisable() {
    if (!confirmDisable) return;
    const res = await fetch(`/api/admin/coupons?id=${confirmDisable.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(`Code « ${confirmDisable.code} » désactivé`);
      router.refresh();
    } else {
      toast.error("Échec de la désactivation");
    }
    setConfirmDisable(null);
  }

  return (
    <>
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="size-4" />
          Créer un code promo
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--background-elevated)] text-[var(--foreground-muted)] text-xs uppercase">
            <tr>
              <th className="text-start px-4 py-3">Code</th>
              <th className="text-start px-4 py-3">Réduction</th>
              <th className="text-start px-4 py-3 hidden sm:table-cell">Durée</th>
              <th className="text-end px-4 py-3">Utilisations</th>
              <th className="text-start px-4 py-3 hidden md:table-cell">Expire</th>
              <th className="text-start px-4 py-3">Statut</th>
              <th className="w-20 px-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {items.map((p) => {
              const reduc = p.coupon.percentOff
                ? `-${p.coupon.percentOff}%`
                : p.coupon.amountOff
                ? `-${(p.coupon.amountOff / 100).toFixed(2)} ${(p.coupon.currency ?? "eur").toUpperCase()}`
                : "—";
              const durationLabel =
                p.coupon.duration === "once"
                  ? "1 paiement"
                  : p.coupon.duration === "forever"
                  ? "À vie"
                  : `${p.coupon.durationInMonths ?? 0} mois`;
              return (
                <tr key={p.id} className={`hover:bg-[var(--background-elevated)] ${!p.active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-mono font-semibold">{p.code}</td>
                  <td className="px-4 py-3 text-[var(--accent)] font-semibold">{reduc}</td>
                  <td className="px-4 py-3 text-xs hidden sm:table-cell">{durationLabel}</td>
                  <td className="px-4 py-3 text-end text-xs">
                    {p.timesRedeemed}
                    {p.maxRedemptions ? <span className="text-[var(--foreground-muted)]"> / {p.maxRedemptions}</span> : ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--foreground-muted)] hidden md:table-cell">
                    {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 ${
                        p.active && p.coupon.valid
                          ? "bg-[var(--success)]/10 text-[var(--success)]"
                          : "bg-[var(--danger)]/10 text-[var(--danger)]"
                      }`}
                    >
                      {p.active && p.coupon.valid ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="px-2 text-end">
                    {p.active && (
                      <button
                        onClick={() => setConfirmDisable({ id: p.id, code: p.code })}
                        className="p-1.5 rounded-lg hover:bg-[var(--background-tile)] text-[var(--danger)]"
                        title="Désactiver"
                      >
                        <Power className="size-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="text-center py-12 text-sm text-[var(--foreground-muted)]">
            <Tag className="size-10 mx-auto mb-2 opacity-30" />
            Aucun code promo. Crée-en un pour offrir des réductions à tes clients.
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-4 text-xs text-[var(--foreground-muted)] space-y-2">
        <p className="font-medium text-[var(--foreground)] flex items-center gap-2">
          <Sparkles className="size-4 text-[var(--accent)]" />
          Comment ça marche ?
        </p>
        <p>
          Le client clique sur « Souscrire » depuis ton site et arrive sur la page de paiement Stripe.
          Il y a un champ <strong>« Code promotionnel »</strong> où il saisit le code que tu lui as donné.
          La réduction est appliquée automatiquement, et le décompte d&apos;utilisation se met à jour ici.
        </p>
        <p>
          Tu peux aussi gérer les codes directement depuis ton{" "}
          <a
            href="https://dashboard.stripe.com/coupons"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] underline"
          >
            dashboard Stripe
          </a>{" "}
          — c&apos;est la même base de données.
        </p>
      </div>

      {showCreate && <CreateCouponModal onClose={() => setShowCreate(false)} onCreated={() => router.refresh()} />}

      <ConfirmDialog
        open={!!confirmDisable}
        title={confirmDisable ? `Désactiver le code « ${confirmDisable.code} » ?` : ""}
        message="Le code ne sera plus utilisable par les clients. Les abonnements en cours qui l'ont déjà utilisé ne sont pas affectés."
        confirmLabel="Désactiver"
        destructive
        onClose={() => setConfirmDisable(null)}
        onConfirm={performDisable}
      />
    </>
  );
}

function CreateCouponModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED_EUR">("PERCENT");
  const [discountValue, setDiscountValue] = useState("25");
  const [duration, setDuration] = useState<"once" | "forever" | "repeating">("once");
  const [durationInMonths, setDurationInMonths] = useState("3");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const payload: Record<string, unknown> = {
      code: code.toUpperCase(),
      discountType,
      discountValue: parseFloat(discountValue),
      duration,
    };
    if (duration === "repeating") payload.durationInMonths = parseInt(durationInMonths, 10);
    if (maxRedemptions) payload.maxRedemptions = parseInt(maxRedemptions, 10);
    if (expiresAt) payload.expiresAt = new Date(expiresAt + "T23:59:59").toISOString();

    const res = await fetch("/api/admin/coupons", {
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
    onCreated();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-auto"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--background-elevated)] border border-[var(--border)] rounded-2xl w-full max-w-md my-8 shadow-2xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h2 className="font-semibold flex items-center gap-2">
            <Tag className="size-5" />
            Nouveau code promo
          </h2>
          <button type="button" onClick={onClose}><X className="size-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Code</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
              placeholder="SUMMER25"
              className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm font-mono uppercase"
            />
            <p className="text-[10px] text-[var(--foreground-muted)] mt-1">
              Lettres, chiffres, _, -. C&apos;est ce que le client tapera.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Type de réduction</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDiscountType("PERCENT")}
                className={`rounded-lg py-2 text-sm border ${
                  discountType === "PERCENT" ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)]"
                }`}
              >
                Pourcentage (%)
              </button>
              <button
                type="button"
                onClick={() => setDiscountType("FIXED_EUR")}
                className={`rounded-lg py-2 text-sm border ${
                  discountType === "FIXED_EUR" ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)]"
                }`}
              >
                Montant fixe (€)
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              Valeur {discountType === "PERCENT" ? "(% de réduction)" : "(€ de réduction)"}
            </label>
            <input
              type="number"
              step={discountType === "PERCENT" ? "1" : "0.5"}
              min="0.01"
              max={discountType === "PERCENT" ? "100" : undefined}
              required
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">S&apos;applique pendant</label>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setDuration("once")} className={`rounded-lg py-2 text-xs border ${duration === "once" ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)]"}`}>
                1 paiement
              </button>
              <button type="button" onClick={() => setDuration("repeating")} className={`rounded-lg py-2 text-xs border ${duration === "repeating" ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)]"}`}>
                N mois
              </button>
              <button type="button" onClick={() => setDuration("forever")} className={`rounded-lg py-2 text-xs border ${duration === "forever" ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)]"}`}>
                À vie
              </button>
            </div>
            {duration === "repeating" && (
              <input
                type="number"
                min="1"
                max="36"
                value={durationInMonths}
                onChange={(e) => setDurationInMonths(e.target.value)}
                placeholder="Nombre de mois"
                className="mt-2 w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                <UsersIcon className="size-3" /> Max utilisations
              </label>
              <input
                type="number"
                min="1"
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                placeholder="Illimité"
                className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                <Calendar className="size-3" /> Expire le
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          {err && <p className="text-sm text-[var(--danger)]">{err}</p>}

          <button type="submit" disabled={busy} className="btn-primary w-full justify-center disabled:opacity-50">
            {busy && <Loader2 className="size-4 animate-spin" />}
            Créer le code
          </button>
        </div>
      </form>
    </div>
  );
}
