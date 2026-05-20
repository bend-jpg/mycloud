"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Trash2,
  X,
  Loader2,
  Ban,
  CheckCircle2,
  HardDrive,
  Pencil,
  Users,
} from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface SubAccount {
  id: string;
  name: string;
  email: string;
  storageQuotaBytes: string;
  storageUsedBytes: string;
  lastLoginAt: string | null;
  createdAt: string;
  suspended: boolean;
}

interface Team {
  id: string;
  name: string;
  type: string;
}

const GB = 1024 ** 3;

export function SubAccountsManager({
  parentQuotaBytes,
  parentUsedBytes,
  planName,
  initialSubAccounts,
  ownedTeams,
}: {
  parentQuotaBytes: string;
  parentUsedBytes: string;
  planName: string;
  initialSubAccounts: SubAccount[];
  ownedTeams: Team[];
}) {
  const router = useRouter();
  const parentQuota = Number(parentQuotaBytes);
  const parentUsed = Number(parentUsedBytes);
  const availableBytes = parentQuota - parentUsed;
  const availableGb = availableBytes / GB;

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [allocatedGb, setAllocatedGb] = useState(5);

  async function createSub(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/sub-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, allocatedGb, locale: "fr" }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.message ?? data.error ?? "Erreur");
      return;
    }
    setShowForm(false);
    setName("");
    setEmail("");
    setPassword("");
    setAllocatedGb(5);
    router.refresh();
  }

  async function changeAllocation(id: string, newGb: number) {
    const res = await fetch(`/api/sub-accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allocatedGb: newGb }),
    });
    if (res.ok) router.refresh();
    else {
      const data = await res.json();
      alert(data.message ?? data.error ?? "Erreur");
    }
  }

  async function toggleSuspend(id: string, suspended: boolean) {
    const res = await fetch(`/api/sub-accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: !suspended }),
    });
    if (res.ok) router.refresh();
  }

  async function deleteSub(id: string, email: string) {
    if (!confirm(`Supprimer le sous-compte ${email} ? Tous ses fichiers seront perdus et le quota retournera dans ton plan.`)) return;
    const res = await fetch(`/api/sub-accounts/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  async function addToTeam(subAccountId: string, teamId: string) {
    // Crée une invitation interne automatique (le sub s'y trouve direct)
    const res = await fetch(`/api/teams/${teamId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: initialSubAccounts.find((s) => s.id === subAccountId)?.email, role: "EDITOR" }),
    });
    if (res.ok) {
      const data = await res.json();
      alert(`Lien d'invitation : ${data.invite.url}\nLe sous-compte peut cliquer dessus pour rejoindre le team.`);
    } else {
      alert("Erreur lors de l'invitation");
    }
  }

  return (
    <>
      {/* Récap quota parent */}
      <div className="tile cursor-default !min-h-0">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="tile-icon">
              <HardDrive className="size-5" />
            </div>
            <div>
              <p className="text-sm text-[var(--foreground-muted)]">Plan {planName}</p>
              <p className="text-2xl font-bold">{formatBytes(availableBytes)} disponibles</p>
              <p className="text-xs text-[var(--foreground-muted)]">
                sur {formatBytes(parentQuota + initialSubAccounts.reduce((s, a) => s + Number(a.storageQuotaBytes), 0))} total
                ({initialSubAccounts.reduce((s, a) => s + Number(a.storageQuotaBytes) / GB, 0).toFixed(1)} Go alloués aux sous-comptes,
                {(parentUsed / GB).toFixed(1)} Go utilisés par toi)
              </p>
            </div>
          </div>
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <UserPlus className="size-4" />
              Créer un sous-compte
            </button>
          )}
        </div>
      </div>

      {/* Formulaire création */}
      {showForm && (
        <form onSubmit={createSub} className="tile cursor-default !min-h-0 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Nouveau sous-compte</h3>
            <button type="button" onClick={() => setShowForm(false)}>
              <X className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--foreground-muted)] mb-1 block">Nom</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--foreground-muted)] mb-1 block">Email (pour login)</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--foreground-muted)] mb-1 block">Mot de passe initial (8+ chars)</label>
              <input
                type="text"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ex : motdepasse123"
                className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm font-mono"
              />
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                Donne-le à la personne — elle pourra le changer ensuite.
              </p>
            </div>
            <div>
              <label className="text-xs text-[var(--foreground-muted)] mb-1 block">
                Espace alloué : <strong>{allocatedGb} Go</strong>
              </label>
              <input
                type="range"
                min={0.5}
                max={Math.max(0.5, availableGb)}
                step={0.5}
                value={allocatedGb}
                onChange={(e) => setAllocatedGb(parseFloat(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                Tu as <strong>{availableGb.toFixed(1)} Go</strong> dispo dans ton plan.
              </p>
            </div>
          </div>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button type="submit" disabled={busy || availableGb <= 0} className="btn-primary text-sm disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Créer le sous-compte
          </button>
        </form>
      )}

      {/* Liste sous-comptes */}
      {initialSubAccounts.length === 0 ? (
        <div className="tile cursor-default !min-h-0 text-center text-sm text-[var(--foreground-muted)] py-8">
          Aucun sous-compte créé. Idéal pour donner un accès à un membre de la famille avec son propre espace privé.
        </div>
      ) : (
        <div className="space-y-3">
          {initialSubAccounts.map((sub) => {
            const subQuota = Number(sub.storageQuotaBytes);
            const subUsed = Number(sub.storageUsedBytes);
            const pct = subQuota > 0 ? Math.round((subUsed / subQuota) * 100) : 0;
            return (
              <div
                key={sub.id}
                className={`tile cursor-default !min-h-0 ${sub.suspended ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-full bg-[var(--background-elevated)] flex items-center justify-center text-lg font-semibold border border-[var(--border)]">
                      {sub.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold">{sub.name}</p>
                      <p className="text-xs text-[var(--foreground-muted)]">{sub.email}</p>
                      <p className="text-xs text-[var(--foreground-muted)] mt-1">
                        Créé le {new Date(sub.createdAt).toLocaleDateString()} ·{" "}
                        {sub.lastLoginAt
                          ? `dernière connexion ${new Date(sub.lastLoginAt).toLocaleDateString()}`
                          : "jamais connecté"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const newGb = prompt(
                          `Nouvelle allocation en Go pour ${sub.name} ?\nActuel : ${(subQuota / GB).toFixed(1)} Go`,
                          (subQuota / GB).toString()
                        );
                        if (newGb) changeAllocation(sub.id, parseFloat(newGb));
                      }}
                      className="btn-ghost text-xs"
                    >
                      <Pencil className="size-3.5" />
                      Quota
                    </button>
                    {ownedTeams.length > 0 && (
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            addToTeam(sub.id, e.target.value);
                            e.target.value = "";
                          }
                        }}
                        className="rounded-full bg-[var(--background-elevated)] border border-[var(--border)] px-3 py-1 text-xs"
                      >
                        <option value="">+ Ajouter à un team...</option>
                        {ownedTeams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => toggleSuspend(sub.id, sub.suspended)}
                      className={`btn-ghost text-xs ${sub.suspended ? "" : "!text-yellow-400"}`}
                    >
                      {sub.suspended ? <CheckCircle2 className="size-3.5" /> : <Ban className="size-3.5" />}
                      {sub.suspended ? "Réactiver" : "Suspendre"}
                    </button>
                    <button
                      onClick={() => deleteSub(sub.id, sub.email)}
                      className="btn-ghost text-xs !text-[var(--danger)]"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-[var(--foreground-muted)] mb-1">
                    Utilisé : {formatBytes(subUsed)} / {formatBytes(subQuota)} ({pct}%)
                  </p>
                  <div className="h-2 rounded-full bg-[var(--background-elevated)] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--secondary)]"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
                {ownedTeams.length === 0 && (
                  <p className="text-xs text-[var(--foreground-muted)] mt-3 flex items-center gap-1">
                    <Users className="size-3" />
                    Crée un espace famille pour pouvoir y ajouter ce sous-compte.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
