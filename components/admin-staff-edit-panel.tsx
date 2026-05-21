"use client";

// Panneau d'édition pour un staff (membre interne).
// Plus simple que la version client : pas de plan, pas de subscription, pas de paiements.
// Onglets : Profil / Rôle / Sécurité (reset password) / Danger zone (suspendre / dégrader en USER / supprimer).

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  User as UserIcon,
  Shield,
  Lock,
  AlertTriangle,
  Loader2,
  Save,
  KeyRound,
  Power,
  Trash2,
  ArrowDownToLine,
} from "lucide-react";

type Role = "ADMIN" | "STAFF_SUPPORT" | "STAFF_BILLING" | "STAFF_OPS";

interface InitialData {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  locale: string;
  role: string;
  isSuspended: boolean;
}

const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  { value: "ADMIN", label: "Super-admin", hint: "Accès total au back-office (toi)" },
  { value: "STAFF_SUPPORT", label: "Support client", hint: "Voit les tickets, peut répondre" },
  { value: "STAFF_BILLING", label: "Comptable", hint: "Voit les paiements et les factures" },
  { value: "STAFF_OPS", label: "Ops / DevOps", hint: "Voit le storage et l'infra" },
];

export function AdminStaffEditPanel({
  userId,
  initial,
}: {
  userId: string;
  initial: InitialData;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"profil" | "role" | "securite" | "danger">("profil");

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] overflow-x-auto">
        <TabButton active={tab === "profil"} onClick={() => setTab("profil")} icon={<UserIcon className="size-4" />}>
          Profil
        </TabButton>
        <TabButton active={tab === "role"} onClick={() => setTab("role")} icon={<Shield className="size-4" />}>
          Rôle
        </TabButton>
        <TabButton active={tab === "securite"} onClick={() => setTab("securite")} icon={<Lock className="size-4" />}>
          Sécurité
        </TabButton>
        <TabButton active={tab === "danger"} onClick={() => setTab("danger")} icon={<AlertTriangle className="size-4" />} danger>
          Danger
        </TabButton>
      </div>

      <div className="p-4 sm:p-6">
        {tab === "profil" && <ProfilTab userId={userId} initial={initial} onChange={() => router.refresh()} />}
        {tab === "role" && <RoleTab userId={userId} initial={initial} onChange={() => router.refresh()} />}
        {tab === "securite" && <SecuriteTab userId={userId} />}
        {tab === "danger" && <DangerTab userId={userId} initial={initial} onChange={() => router.refresh()} />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
  danger,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
        active
          ? danger
            ? "border-[var(--danger)] text-[var(--danger)]"
            : "border-[var(--accent)] text-[var(--accent)]"
          : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ============================================================
// Profil
// ============================================================
function ProfilTab({ userId, initial, onChange }: { userId: string; initial: InitialData; onChange: () => void }) {
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp);
  const [locale, setLocale] = useState(initial.locale);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function save() {
    setBusy(true);
    setErr(null);
    setOk(false);
    const res = await fetch(`/api/admin/clients/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone: phone || null, whatsapp: whatsapp || null, locale }),
    });
    setBusy(false);
    if (res.ok) {
      setOk(true);
      onChange();
      setTimeout(() => setOk(false), 2000);
    } else {
      const data = await res.json().catch(() => null);
      setErr(data?.error ?? "Erreur");
    }
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Nom"><input value={name} onChange={(e) => setName(e.target.value)} className="input w-full" /></Field>
        <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input w-full" /></Field>
        <Field label="Téléphone"><input value={phone} onChange={(e) => setPhone(e.target.value)} className="input w-full" /></Field>
        <Field label="WhatsApp"><input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="input w-full" /></Field>
        <Field label="Langue">
          <select value={locale} onChange={(e) => setLocale(e.target.value)} className="input w-full">
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="he">עברית</option>
          </select>
        </Field>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <button onClick={save} disabled={busy} className="btn-primary">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Enregistrer
        </button>
        {ok && <span className="text-xs text-[var(--success)]">✓ Sauvegardé</span>}
        {err && <span className="text-xs text-[var(--danger)]">{err}</span>}
      </div>
    </div>
  );
}

// ============================================================
// Rôle
// ============================================================
function RoleTab({ userId, initial, onChange }: { userId: string; initial: InitialData; onChange: () => void }) {
  const [role, setRole] = useState<Role>(initial.role as Role);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  async function save() {
    setBusy(true);
    setOk(false);
    const res = await fetch(`/api/admin/clients/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setBusy(false);
    if (res.ok) {
      setOk(true);
      onChange();
      setTimeout(() => setOk(false), 2000);
    }
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <p className="text-sm text-[var(--foreground-muted)]">
        Choisis le rôle de ce membre. Le rôle détermine ce qu&apos;il peut voir dans le back-office.
      </p>
      <div className="space-y-2">
        {ROLE_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
              role === opt.value
                ? "border-[var(--accent)] bg-[var(--accent)]/5"
                : "border-[var(--border)] hover:bg-[var(--background-elevated)]"
            }`}
          >
            <input
              type="radio"
              name="role"
              value={opt.value}
              checked={role === opt.value}
              onChange={() => setRole(opt.value)}
              className="mt-1 accent-[var(--accent)]"
            />
            <div>
              <p className="font-medium text-sm">{opt.label}</p>
              <p className="text-xs text-[var(--foreground-muted)]">{opt.hint}</p>
            </div>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-2">
        <button onClick={save} disabled={busy || role === initial.role} className="btn-primary">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Appliquer le rôle
        </button>
        {ok && <span className="text-xs text-[var(--success)]">✓ Rôle mis à jour</span>}
      </div>
    </div>
  );
}

// ============================================================
// Sécurité (reset password)
// ============================================================
function SecuriteTab({ userId }: { userId: string }) {
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reset() {
    if (pwd.length < 8) {
      setErr("Min 8 caractères");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/admin/clients/${userId}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: pwd }),
    });
    setBusy(false);
    if (res.ok) {
      setOk(true);
      setPwd("");
      setTimeout(() => setOk(false), 2500);
    } else {
      const data = await res.json().catch(() => null);
      setErr(data?.error ?? "Erreur");
    }
  }

  return (
    <div className="space-y-4 max-w-md">
      <div>
        <p className="font-medium text-sm">Réinitialiser le mot de passe</p>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">
          Le staff devra utiliser ce nouveau mot de passe à sa prochaine connexion. Tu lui transmets en main propre / chat sécurisé.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="Nouveau mot de passe (min 8)"
          className="input flex-1"
        />
        <button onClick={reset} disabled={busy} className="btn-primary">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Réinitialiser
        </button>
      </div>
      {ok && <p className="text-xs text-[var(--success)]">✓ Mot de passe changé</p>}
      {err && <p className="text-xs text-[var(--danger)]">{err}</p>}
    </div>
  );
}

// ============================================================
// Danger zone
// ============================================================
function DangerTab({ userId, initial, onChange }: { userId: string; initial: InitialData; onChange: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggleSuspend() {
    if (!confirm(initial.isSuspended ? "Réactiver ce membre ?" : "Suspendre ce membre ? Il ne pourra plus se connecter.")) return;
    setBusy(true);
    await fetch(`/api/admin/clients/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: !initial.isSuspended }),
    });
    setBusy(false);
    onChange();
  }

  async function demoteToUser() {
    if (!confirm("Convertir ce staff en utilisateur classique (USER) ? Il perdra tous ses droits admin.")) return;
    setBusy(true);
    await fetch(`/api/admin/clients/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "USER" }),
    });
    setBusy(false);
    router.push(`/admin/clients/${userId}`);
  }

  async function remove() {
    if (!confirm("⚠️ SUPPRIMER définitivement ce membre ? Cette action est IRRÉVERSIBLE.")) return;
    if (!confirm("Es-tu vraiment sûr ? Tape OK pour confirmer.")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/clients/${userId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.push("/admin/staff");
  }

  return (
    <div className="space-y-3">
      <DangerRow
        icon={<Power className="size-5" />}
        title={initial.isSuspended ? "Réactiver" : "Suspendre"}
        description={
          initial.isSuspended
            ? "Permet de nouveau la connexion."
            : "Bloque la connexion. Les données restent intactes."
        }
        actionLabel={initial.isSuspended ? "Réactiver" : "Suspendre"}
        onClick={toggleSuspend}
        busy={busy}
      />
      <DangerRow
        icon={<ArrowDownToLine className="size-5" />}
        title="Convertir en utilisateur"
        description="Retire les droits admin et le déplace dans la liste des clients."
        actionLabel="Dégrader en USER"
        onClick={demoteToUser}
        busy={busy}
      />
      <DangerRow
        icon={<Trash2 className="size-5" />}
        title="Supprimer le compte"
        description="Action irréversible. Toutes les données (fichiers, tickets, sessions) seront détruites."
        actionLabel="Supprimer définitivement"
        onClick={remove}
        busy={busy}
        critical
      />
    </div>
  );
}

function DangerRow({
  icon,
  title,
  description,
  actionLabel,
  onClick,
  busy,
  critical,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
  busy: boolean;
  critical?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 flex items-center gap-3 ${
        critical ? "border-[var(--danger)]/40 bg-[var(--danger)]/5" : "border-[var(--border)]"
      }`}
    >
      <div className={`shrink-0 ${critical ? "text-[var(--danger)]" : "text-[var(--foreground-muted)]"}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-[var(--foreground-muted)]">{description}</p>
      </div>
      <button
        onClick={onClick}
        disabled={busy}
        className={`text-xs rounded-lg px-3 py-2 whitespace-nowrap ${
          critical
            ? "bg-[var(--danger)] text-white hover:opacity-90"
            : "border border-[var(--border)] hover:bg-[var(--background-elevated)]"
        }`}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-[var(--foreground-muted)] mb-1">{label}</label>
      {children}
    </div>
  );
}
