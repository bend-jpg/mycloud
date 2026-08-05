"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Check,
  Save,
  Ban,
  CheckCircle2,
  KeyRound,
  CalendarClock,
  MessageSquare,
  Trash2,
  HardDrive,
} from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface Plan {
  slug: string;
  name: string;
  storageBytes: string;
}

interface Props {
  userId: string;
  initial: {
    name: string;
    email: string;
    phone: string;
    whatsapp: string;
    locale: string;
    planSlug: string | null;
    storageQuotaBytes: string;
    isSuspended: boolean;
    subscription: {
      currentPeriodEnd: string | null;
      status: string;
      cancelAtPeriodEnd: boolean;
    } | null;
  };
  allPlans: Plan[];
}

const GB = 1024 ** 3;

type Tab = "profile" | "plan" | "security" | "message" | "danger";

export function AdminClientEditPanel({ userId, initial, allPlans }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div className="tile cursor-default !min-h-0">
      <div className="flex items-center gap-1 flex-wrap mb-4 border-b border-[var(--border)] pb-2 -mx-2 px-2 overflow-x-auto">
        {[
          { id: "profile" as const, label: "Profil" },
          { id: "plan" as const, label: "Plan & abonnement" },
          { id: "security" as const, label: "Sécurité" },
          { id: "message" as const, label: "Message client" },
          { id: "danger" as const, label: "Suspendre / Supprimer" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
              tab === t.id
                ? "bg-[var(--accent)]/10 text-[var(--accent)] font-medium"
                : "text-[var(--foreground-muted)] hover:bg-[var(--background-tile)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && <ProfileTab userId={userId} initial={initial} onSaved={() => router.refresh()} />}
      {tab === "plan" && <PlanTab userId={userId} initial={initial} allPlans={allPlans} onSaved={() => router.refresh()} />}
      {tab === "security" && <SecurityTab userId={userId} onSaved={() => router.refresh()} />}
      {tab === "message" && <MessageTab userId={userId} />}
      {tab === "danger" && (
        <DangerTab
          userId={userId}
          isSuspended={initial.isSuspended}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}

// ============================================================
// PROFIL
// ============================================================
function ProfileTab({
  userId,
  initial,
  onSaved,
}: {
  userId: string;
  initial: Props["initial"];
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp);
  const [locale, setLocale] = useState(initial.locale);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/admin/clients/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        phone: phone || null,
        whatsapp: whatsapp || null,
        locale,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error === "EMAIL_ALREADY_USED" ? "Email déjà utilisé par un autre compte." : "Erreur");
      return;
    }
    setSaved(true);
    onSaved();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[var(--foreground-muted)] mb-1 block">Nom</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--foreground-muted)] mb-1 block">Email (login)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--foreground-muted)] mb-1 block">Téléphone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--foreground-muted)] mb-1 block">WhatsApp</label>
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--foreground-muted)] mb-1 block">Langue préférée</label>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="he">עברית</option>
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn-primary text-sm disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Enregistrer
        </button>
        {saved && (
          <span className="text-sm text-[var(--success)] flex items-center gap-1">
            <Check className="size-4" /> Enregistré
          </span>
        )}
      </div>
    </form>
  );
}

// ============================================================
// PLAN & ABONNEMENT
// ============================================================
function PlanTab({
  userId,
  initial,
  allPlans,
  onSaved,
}: {
  userId: string;
  initial: Props["initial"];
  allPlans: Plan[];
  onSaved: () => void;
}) {
  const [planSlug, setPlanSlug] = useState(initial.planSlug ?? "");
  const [quotaGb, setQuotaGb] = useState((Number(initial.storageQuotaBytes) / GB).toFixed(1));
  const [periodEnd, setPeriodEnd] = useState(
    initial.subscription?.currentPeriodEnd
      ? new Date(initial.subscription.currentPeriodEnd).toISOString().slice(0, 10)
      : ""
  );
  const [subStatus, setSubStatus] = useState(initial.subscription?.status ?? "ACTIVE");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function savePlan() {
    setBusy(true);
    const planUpdate = await fetch(`/api/admin/clients/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planSlug: planSlug || undefined,
        storageQuotaBytes: BigInt(Math.round(parseFloat(quotaGb) * GB)).toString(),
      }),
    });
    if (periodEnd || subStatus) {
      await fetch(`/api/admin/clients/${userId}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPeriodEnd: periodEnd ? new Date(periodEnd + "T23:59:59").toISOString() : undefined,
          status: subStatus,
        }),
      });
    }
    setBusy(false);
    if (planUpdate.ok) {
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2500);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-[var(--foreground-muted)] mb-2 block">Plan</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {allPlans.map((p) => (
            <button
              key={p.slug}
              onClick={() => {
                setPlanSlug(p.slug);
                // Aligne le quota sur le plan choisi. Sans ça, le champ gardait
                // l'ancienne valeur et, comme l'API applique le quota APRÈS le
                // plan, elle écrasait le quota du nouveau plan (un client passé
                // en Famille restait bloqué à 50 Go).
                setQuotaGb((Number(p.storageBytes) / GB).toFixed(1));
              }}
              className={`rounded-xl p-3 text-start border transition-colors ${
                planSlug === p.slug
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)]"
              }`}
            >
              <p className="font-medium text-sm">{p.name}</p>
              <p className="text-xs text-[var(--foreground-muted)]">{formatBytes(Number(p.storageBytes))}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-[var(--foreground-muted)] mb-1 block flex items-center gap-1">
            <HardDrive className="size-3.5" /> Quota override (Go)
          </label>
          <input
            type="number"
            step="0.5"
            value={quotaGb}
            onChange={(e) => setQuotaGb(e.target.value)}
            className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--foreground-muted)] mb-1 block flex items-center gap-1">
            <CalendarClock className="size-3.5" /> Fin d&apos;abonnement
          </label>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--foreground-muted)] mb-1 block">Statut abonnement</label>
          <select
            value={subStatus}
            onChange={(e) => setSubStatus(e.target.value)}
            className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
          >
            <option value="ACTIVE">Actif</option>
            <option value="PAST_DUE">Impayé</option>
            <option value="TRIAL">Essai</option>
            <option value="PAUSED">En pause</option>
            <option value="CANCELED">Annulé</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={savePlan} disabled={busy} className="btn-primary text-sm disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Enregistrer plan & abonnement
        </button>
        {saved && (
          <span className="text-sm text-[var(--success)] flex items-center gap-1">
            <Check className="size-4" /> Mis à jour
          </span>
        )}
      </div>
      <p className="text-xs text-[var(--foreground-muted)]">
        ⚠️ Changer le plan applique immédiatement le nouveau quota et tarif. Les paiements existants ne sont pas
        proratisés automatiquement — ajuste manuellement la date de fin si besoin.
      </p>
    </div>
  );
}

// ============================================================
// SÉCURITÉ
// ============================================================
function SecurityTab({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    setError(null);
    if (pwd.length < 8) {
      setError("Au moins 8 caractères");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/clients/${userId}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: pwd }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Erreur");
      return;
    }
    setSaved(true);
    setPwd("");
    onSaved();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-3 max-w-md">
      <p className="text-sm text-[var(--foreground-muted)]">
        Force un nouveau mot de passe pour ce client. Communique-lui en sécurisé. Il pourra ensuite le changer
        depuis ses paramètres.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="Nouveau mot de passe (8+ caractères)"
          className="flex-1 rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm font-mono"
        />
        <button onClick={reset} disabled={busy || pwd.length < 8} className="btn-primary text-sm disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Définir
        </button>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {saved && (
        <p className="text-sm text-[var(--success)] flex items-center gap-1">
          <Check className="size-4" /> Mot de passe mis à jour
        </p>
      )}
    </div>
  );
}

// ============================================================
// MESSAGE
// ============================================================
function MessageTab({ userId }: { userId: string }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(`/api/admin/clients/${userId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body, priority }),
    });
    setBusy(false);
    if (res.ok) {
      setSent(true);
      setSubject("");
      setBody("");
      setTimeout(() => setSent(false), 3000);
    } else {
      alert("Erreur");
    }
  }

  return (
    <form onSubmit={send} className="space-y-3 max-w-2xl">
      <p className="text-sm text-[var(--foreground-muted)]">
        Crée un ticket dans la boîte du client avec ton message. Il recevra une notification + email
        (si Resend configuré).
      </p>
      <input
        required
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Sujet"
        maxLength={140}
        className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
      />
      <textarea
        required
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        maxLength={4000}
        placeholder="Ton message..."
        className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm resize-y"
      />
      <div className="flex items-center gap-3">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as typeof priority)}
          className="rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
        >
          <option value="LOW">Basse</option>
          <option value="NORMAL">Normale</option>
          <option value="HIGH">Haute</option>
          <option value="URGENT">Urgente</option>
        </select>
        <button type="submit" disabled={busy || !subject || !body} className="btn-primary text-sm disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4" />}
          Envoyer
        </button>
        {sent && (
          <span className="text-sm text-[var(--success)] flex items-center gap-1">
            <Check className="size-4" /> Envoyé
          </span>
        )}
      </div>
    </form>
  );
}

// ============================================================
// SUSPENDRE / SUPPRIMER
// ============================================================
function DangerTab({
  userId,
  isSuspended,
  onChanged,
}: {
  userId: string;
  isSuspended: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function toggleSuspend() {
    if (!confirm(isSuspended ? "Réactiver ce client ?" : "Suspendre ce client ?")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/clients/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: !isSuspended }),
    });
    setBusy(false);
    if (res.ok) onChanged();
  }

  async function deleteClient() {
    const c1 = confirm("⚠️ Supprimer définitivement ce client + tous ses fichiers ?");
    if (!c1) return;
    const c2 = prompt("Pour confirmer, tape : SUPPRIMER");
    if (c2 !== "SUPPRIMER") return;
    setBusy(true);
    const res = await fetch(`/api/admin/clients/${userId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) window.location.href = "/admin/clients";
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4">
        <h3 className="font-medium text-sm flex items-center gap-2">
          {isSuspended ? <CheckCircle2 className="size-4 text-[var(--success)]" /> : <Ban className="size-4 text-yellow-400" />}
          {isSuspended ? "Réactiver le client" : "Suspendre le client"}
        </h3>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">
          {isSuspended
            ? "Le client pourra à nouveau se connecter et accéder à son compte."
            : "Le client ne pourra plus se connecter. Ses données restent intactes."}
        </p>
        <button onClick={toggleSuspend} disabled={busy} className="btn-ghost text-sm mt-2 disabled:opacity-50">
          {isSuspended ? "Réactiver" : "Suspendre"}
        </button>
      </div>

      <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-4">
        <h3 className="font-medium text-sm flex items-center gap-2 text-[var(--danger)]">
          <Trash2 className="size-4" />
          Supprimer le compte
        </h3>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">
          Suppression définitive du compte et de TOUS ses fichiers. Action irréversible.
          Audit log gardé pour traçabilité.
        </p>
        <button onClick={deleteClient} disabled={busy} className="btn-ghost text-sm mt-2 !text-[var(--danger)] disabled:opacity-50">
          <Trash2 className="size-4" />
          Supprimer définitivement
        </button>
      </div>
    </div>
  );
}
