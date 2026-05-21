"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Pencil, Trash2, Loader2, Star, Eye, EyeOff } from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface Plan {
  id: string;
  slug: string;
  name: string;
  descriptionFr: string | null;
  descriptionEn: string | null;
  descriptionEs: string | null;
  descriptionHe: string | null;
  storageBytes: string;
  maxMembers: number;
  maxShareLinks: number;
  maxShareDays: number;
  websiteHosting: boolean;
  claudeCodeHosting: boolean;
  priceMonthlyEur: number;
  priceYearlyEur: number;
  priceMonthlyUsd: number;
  priceYearlyUsd: number;
  active: boolean;
  highlighted: boolean;
  sortOrder: number;
  userCount: number;
}

const GB = 1024 ** 3;

type FormData = Omit<Plan, "id" | "storageBytes" | "userCount"> & { storageGb: number };

const EMPTY: FormData = {
  slug: "",
  name: "",
  descriptionFr: "",
  descriptionEn: "",
  descriptionEs: "",
  descriptionHe: "",
  storageGb: 50,
  maxMembers: 1,
  maxShareLinks: 100,
  maxShareDays: 30,
  websiteHosting: false,
  claudeCodeHosting: false,
  priceMonthlyEur: 299,
  priceYearlyEur: 2990,
  priceMonthlyUsd: 349,
  priceYearlyUsd: 3490,
  active: true,
  highlighted: false,
  sortOrder: 5,
};

export function AdminPlansManager({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Plan | null>(null);

  async function deletePlan(plan: Plan) {
    const res = await fetch(`/api/admin/plans/${plan.id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
      setConfirmDelete(null);
    } else {
      alert("Erreur");
    }
  }

  async function toggleActive(plan: Plan) {
    await fetch(`/api/admin/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !plan.active }),
    });
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--foreground-muted)]">{plans.length} plan(s)</p>
        <button onClick={() => setCreating(true)} className="btn-primary text-sm">
          <Plus className="size-4" /> Nouveau plan
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--background-elevated)] text-[var(--foreground-muted)] text-xs uppercase">
            <tr>
              <th className="text-start px-4 py-3">Plan</th>
              <th className="text-end px-4 py-3 hidden sm:table-cell">Stockage</th>
              <th className="text-end px-4 py-3 hidden md:table-cell">Membres</th>
              <th className="text-end px-4 py-3">Mensuel</th>
              <th className="text-end px-4 py-3 hidden md:table-cell">Annuel</th>
              <th className="text-end px-4 py-3 hidden sm:table-cell">Clients</th>
              <th className="w-28 px-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {plans.map((plan) => (
              <tr
                key={plan.id}
                className={`hover:bg-[var(--background-elevated)] ${!plan.active ? "opacity-60" : ""}`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{plan.name}</span>
                    {plan.highlighted && (
                      <span className="inline-flex items-center gap-1 text-[10px] rounded-full bg-[var(--accent)]/10 text-[var(--accent)] px-1.5 py-0.5">
                        <Star className="size-2.5" /> Pop
                      </span>
                    )}
                    {!plan.active && (
                      <span className="text-[10px] rounded-full bg-[var(--danger)]/10 text-[var(--danger)] px-1.5 py-0.5">Off</span>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--foreground-muted)] font-mono">{plan.slug}</p>
                </td>
                <td className="px-4 py-3 text-end text-xs hidden sm:table-cell">
                  {formatBytes(BigInt(plan.storageBytes))}
                </td>
                <td className="px-4 py-3 text-end text-xs hidden md:table-cell">{plan.maxMembers}</td>
                <td className="px-4 py-3 text-end text-xs">
                  <strong>{(plan.priceMonthlyEur / 100).toFixed(2)} €</strong>
                  <br />
                  <span className="text-[10px] text-[var(--foreground-muted)]">
                    {(plan.priceMonthlyUsd / 100).toFixed(2)} $
                  </span>
                </td>
                <td className="px-4 py-3 text-end text-xs hidden md:table-cell">
                  <strong>{(plan.priceYearlyEur / 100).toFixed(2)} €</strong>
                  <br />
                  <span className="text-[10px] text-[var(--foreground-muted)]">
                    {(plan.priceYearlyUsd / 100).toFixed(2)} $
                  </span>
                </td>
                <td className="px-4 py-3 text-end text-xs hidden sm:table-cell">{plan.userCount}</td>
                <td className="px-2 text-end">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => toggleActive(plan)}
                      className="p-1.5 rounded-lg hover:bg-[var(--background-tile)]"
                      title={plan.active ? "Désactiver" : "Activer"}
                    >
                      {plan.active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                    <button
                      onClick={() => setEditingPlan(plan)}
                      className="p-1.5 rounded-lg hover:bg-[var(--background-tile)]"
                      title="Modifier"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(plan)}
                      className="p-1.5 rounded-lg hover:bg-[var(--background-tile)] text-[var(--danger)]"
                      title="Supprimer"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {plans.length === 0 && (
          <div className="text-center text-sm text-[var(--foreground-muted)] py-8">
            Aucun plan. Crée-en un.
          </div>
        )}
      </div>

      {(creating || editingPlan) && (
        <PlanForm
          initial={
            editingPlan
              ? { ...editingPlan, storageGb: Number(editingPlan.storageBytes) / GB }
              : EMPTY
          }
          mode={editingPlan ? "edit" : "create"}
          planId={editingPlan?.id}
          onClose={() => { setCreating(false); setEditingPlan(null); router.refresh(); }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-[var(--background-elevated)] border border-[var(--border)] rounded-2xl max-w-md p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">Désactiver le plan {confirmDelete.name} ?</h2>
            <p className="text-sm text-[var(--foreground-muted)] mt-2">
              Le plan reste en DB (les {confirmDelete.userCount} client(s) actuels gardent leur abonnement),
              mais il n&apos;est plus proposé aux nouveaux inscrits.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setConfirmDelete(null)} className="btn-ghost text-sm">Annuler</button>
              <button onClick={() => deletePlan(confirmDelete)} className="btn-primary text-sm !bg-[var(--danger)]">Désactiver</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PlanForm({
  initial,
  mode,
  planId,
  onClose,
}: {
  initial: FormData;
  mode: "edit" | "create";
  planId?: string;
  onClose: () => void;
}) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      ...data,
      storageBytes: BigInt(Math.round(data.storageGb * GB)).toString(),
      storageGb: undefined,
    };
    delete (payload as Record<string, unknown>).storageGb;
    const url = mode === "create" ? "/api/admin/plans" : `/api/admin/plans/${planId}`;
    const res = await fetch(url, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.message ?? d.error ?? "Erreur");
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-auto" onClick={onClose}>
      <div className="bg-[var(--background-elevated)] border border-[var(--border)] rounded-2xl max-w-2xl w-full my-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h2 className="font-semibold">{mode === "create" ? "Nouveau plan" : `Modifier ${data.name}`}</h2>
          <button onClick={onClose}><X className="size-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Slug (URL-friendly)" disabled={mode === "edit"}>
              <input
                type="text"
                required
                value={data.slug}
                onChange={(e) => update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="famille-plus"
                disabled={mode === "edit"}
                className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50"
              />
            </Field>
            <Field label="Nom affiché">
              <input
                type="text"
                required
                value={data.name}
                onChange={(e) => update("name", e.target.value)}
                className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <Field label="Description FR">
            <textarea
              value={data.descriptionFr ?? ""}
              onChange={(e) => update("descriptionFr", e.target.value)}
              rows={2}
              className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm resize-y"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="EN"><input value={data.descriptionEn ?? ""} onChange={(e) => update("descriptionEn", e.target.value)} className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm" /></Field>
            <Field label="ES"><input value={data.descriptionEs ?? ""} onChange={(e) => update("descriptionEs", e.target.value)} className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm" /></Field>
            <Field label="HE"><input value={data.descriptionHe ?? ""} onChange={(e) => update("descriptionHe", e.target.value)} className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm" dir="rtl" /></Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Stockage (Go)">
              <input type="number" step="0.5" min="0.1" required value={data.storageGb} onChange={(e) => update("storageGb", parseFloat(e.target.value))} className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm" />
            </Field>
            <Field label="Membres max">
              <input type="number" min="1" required value={data.maxMembers} onChange={(e) => update("maxMembers", parseInt(e.target.value))} className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm" />
            </Field>
            <Field label="Ordre d'affichage">
              <input type="number" value={data.sortOrder} onChange={(e) => update("sortOrder", parseInt(e.target.value))} className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Liens partage max"><input type="number" value={data.maxShareLinks} onChange={(e) => update("maxShareLinks", parseInt(e.target.value))} className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm" /></Field>
            <Field label="Durée max partage (jours)"><input type="number" value={data.maxShareDays} onChange={(e) => update("maxShareDays", parseInt(e.target.value))} className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm" /></Field>
          </div>

          <p className="text-xs font-semibold text-[var(--foreground-muted)] mt-2">Prix (en centimes)</p>
          <div className="grid grid-cols-4 gap-3">
            <Field label="EUR / mois"><input type="number" value={data.priceMonthlyEur} onChange={(e) => update("priceMonthlyEur", parseInt(e.target.value))} className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm" /></Field>
            <Field label="EUR / an"><input type="number" value={data.priceYearlyEur} onChange={(e) => update("priceYearlyEur", parseInt(e.target.value))} className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm" /></Field>
            <Field label="USD / mois"><input type="number" value={data.priceMonthlyUsd} onChange={(e) => update("priceMonthlyUsd", parseInt(e.target.value))} className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm" /></Field>
            <Field label="USD / an"><input type="number" value={data.priceYearlyUsd} onChange={(e) => update("priceYearlyUsd", parseInt(e.target.value))} className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm" /></Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={data.websiteHosting} onChange={(e) => update("websiteHosting", e.target.checked)} className="accent-[var(--accent)]" />
              Hébergement sites web inclus
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={data.claudeCodeHosting} onChange={(e) => update("claudeCodeHosting", e.target.checked)} className="accent-[var(--accent)]" />
              Hébergement Claude Code inclus
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={data.highlighted} onChange={(e) => update("highlighted", e.target.checked)} className="accent-[var(--accent)]" />
              Mis en avant sur landing (badge "Populaire")
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={data.active} onChange={(e) => update("active", e.target.checked)} className="accent-[var(--accent)]" />
              Plan actif (visible et achetable)
            </label>
          </div>

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <button type="button" onClick={onClose} className="btn-ghost text-sm">Annuler</button>
            <button type="submit" disabled={busy} className="btn-primary text-sm disabled:opacity-50">
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === "create" ? "Créer" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children, disabled }: { label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <div className={disabled ? "opacity-60" : ""}>
      <label className="text-xs text-[var(--foreground-muted)] mb-1 block">{label}</label>
      {children}
    </div>
  );
}
