"use client";

// UI de gestion des préférences de notification.
// 3 colonnes (in-app / email / push) × N types. Toggle individuel.
// 3 boutons rapides : tout activer / désactiver / défauts.

import { useEffect, useState } from "react";
import { Bell, Mail, Smartphone, Loader2, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { useToast } from "./toast";

interface ChannelPrefs {
  inApp: boolean;
  email: boolean;
  push: boolean;
}

type NotifType =
  | "QUOTA_WARNING"
  | "QUOTA_EXCEEDED"
  | "PAYMENT_FAILED"
  | "PAYMENT_SUCCEEDED"
  | "SHARE_DOWNLOADED"
  | "INVITE_ACCEPTED"
  | "INVITE_RECEIVED"
  | "TICKET_REPLY"
  | "SYSTEM"
  | "FILES_UPLOADED";

interface TypeInfo {
  type: NotifType;
  label: string;
  description: string;
  importance: "critical" | "important" | "info";
}

// Doit matcher lib/notification-prefs.ts NOTIFICATION_TYPE_INFO (sans ADMIN_ALERT)
const TYPES: TypeInfo[] = [
  { type: "QUOTA_EXCEEDED",    label: "Quota dépassé",           description: "Ton espace est plein — uploads bloqués.", importance: "critical" },
  { type: "QUOTA_WARNING",     label: "Quota presque atteint",   description: "À 80% ou 95% de ton espace.", importance: "important" },
  { type: "PAYMENT_FAILED",    label: "Paiement échoué",         description: "Une de tes cartes a refusé un paiement.", importance: "critical" },
  { type: "PAYMENT_SUCCEEDED", label: "Paiement confirmé",       description: "Récap quand un paiement est validé.", importance: "info" },
  { type: "INVITE_RECEIVED",   label: "Invitation reçue",        description: "Quelqu'un t'a invité dans son espace famille.", importance: "important" },
  { type: "INVITE_ACCEPTED",   label: "Invitation acceptée",     description: "Quelqu'un a accepté ton invitation famille.", importance: "info" },
  { type: "SHARE_DOWNLOADED",  label: "Téléchargement de tes liens", description: "Quand quelqu'un télécharge un fichier que tu as partagé.", importance: "info" },
  { type: "TICKET_REPLY",      label: "Réponse à tes tickets",   description: "L'équipe support a répondu à ton message.", importance: "important" },
  { type: "FILES_UPLOADED",    label: "Sauvegarde de fichiers",  description: "Récap quand des photos ou fichiers sont sauvegardés (sync auto).", importance: "info" },
  { type: "SYSTEM",            label: "Annonces MyTitanCloud",   description: "Nouvelles fonctionnalités, maintenance prévue, etc.", importance: "info" },
];

const IMPORTANCE_ICON = {
  critical: { icon: AlertCircle, color: "text-[var(--danger)]" },
  important: { icon: AlertTriangle, color: "text-yellow-400" },
  info: { icon: Info, color: "text-[var(--foreground-muted)]" },
};

export function NotificationPrefsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<Record<NotifType, ChannelPrefs>>({} as Record<NotifType, ChannelPrefs>);
  const [defaults, setDefaults] = useState<Record<NotifType, ChannelPrefs>>({} as Record<NotifType, ChannelPrefs>);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/me/notification-prefs", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setPrefs(data.prefs ?? {});
        setDefaults(data.defaults ?? {});
      })
      .catch(() => toast.error("Impossible de charger tes préférences"))
      .finally(() => setLoading(false));
  }, [toast]);

  async function saveAll(next: Record<NotifType, ChannelPrefs>) {
    setSaving(true);
    try {
      const res = await fetch("/api/me/notification-prefs", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefs: next }),
      });
      if (!res.ok) throw new Error();
      setPrefs(next);
    } catch {
      toast.error("Sauvegarde échouée — réessaie");
    } finally {
      setSaving(false);
    }
  }

  function toggleChannel(type: NotifType, channel: keyof ChannelPrefs) {
    const current = prefs[type] ?? defaults[type] ?? { inApp: true, email: false, push: false };
    const next = { ...prefs, [type]: { ...current, [channel]: !current[channel] } };
    saveAll(next);
  }

  function setAllChannel(channel: keyof ChannelPrefs, value: boolean) {
    const next: Record<NotifType, ChannelPrefs> = { ...prefs };
    for (const { type } of TYPES) {
      const current = prefs[type] ?? defaults[type] ?? { inApp: true, email: false, push: false };
      next[type] = { ...current, [channel]: value };
    }
    saveAll(next);
  }

  function resetDefaults() {
    saveAll({} as Record<NotifType, ChannelPrefs>);
    toast.success("Préférences remises aux valeurs par défaut");
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-6 flex items-center justify-center">
        <Loader2 className="size-5 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-hidden">
      {/* Header avec actions rapides */}
      <div className="p-5 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Bell className="size-5 text-[var(--accent)]" />
            Préférences de notification
          </h2>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            Choisis ce que tu veux recevoir, et comment. Tes choix s'appliquent immédiatement.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setAllChannel("inApp", true)}
            disabled={saving}
            className="text-xs px-3 py-1.5 rounded-full bg-[var(--background-elevated)] border border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-50"
          >
            Tout activer in-app
          </button>
          <button
            onClick={() => setAllChannel("email", false)}
            disabled={saving}
            className="text-xs px-3 py-1.5 rounded-full bg-[var(--background-elevated)] border border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-50"
          >
            Désactiver tous les emails
          </button>
          <button
            onClick={resetDefaults}
            disabled={saving}
            className="text-xs px-3 py-1.5 rounded-full bg-[var(--background-elevated)] border border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-50"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Header des colonnes */}
      <div className="hidden sm:grid grid-cols-[1fr_70px_70px_70px] gap-2 px-5 py-3 border-b border-[var(--border)] bg-[var(--background)]/30 text-xs uppercase font-medium text-[var(--foreground-muted)]">
        <div>Type de notification</div>
        <div className="text-center inline-flex items-center justify-center gap-1" title="Dans l'app">
          <Bell className="size-3.5" /> In-app
        </div>
        <div className="text-center inline-flex items-center justify-center gap-1" title="Par email">
          <Mail className="size-3.5" /> Email
        </div>
        <div className="text-center inline-flex items-center justify-center gap-1" title="Notification push mobile/desktop">
          <Smartphone className="size-3.5" /> Push
        </div>
      </div>

      {/* Lignes */}
      <ul className="divide-y divide-[var(--border)]">
        {TYPES.map(({ type, label, description, importance }) => {
          const p = prefs[type] ?? defaults[type] ?? { inApp: true, email: false, push: false };
          const Icon = IMPORTANCE_ICON[importance].icon;
          return (
            <li key={type} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_70px_70px_70px] gap-2 px-5 py-4 items-center">
              <div className="min-w-0">
                <p className="font-medium text-sm inline-flex items-center gap-2">
                  <Icon className={`size-4 shrink-0 ${IMPORTANCE_ICON[importance].color}`} />
                  {label}
                </p>
                <p className="text-xs text-[var(--foreground-muted)] mt-0.5 line-clamp-2">{description}</p>
              </div>
              <div className="sm:hidden text-xs text-[var(--foreground-muted)] flex gap-3">
                <ChannelToggle on={p.inApp} onClick={() => toggleChannel(type, "inApp")} icon={Bell} label="In-app" />
                <ChannelToggle on={p.email} onClick={() => toggleChannel(type, "email")} icon={Mail} label="Email" />
                <ChannelToggle on={p.push} onClick={() => toggleChannel(type, "push")} icon={Smartphone} label="Push" />
              </div>
              <div className="hidden sm:flex justify-center">
                <Toggle on={p.inApp} onClick={() => toggleChannel(type, "inApp")} disabled={saving} />
              </div>
              <div className="hidden sm:flex justify-center">
                <Toggle on={p.email} onClick={() => toggleChannel(type, "email")} disabled={saving} />
              </div>
              <div className="hidden sm:flex justify-center">
                <Toggle on={p.push} onClick={() => toggleChannel(type, "push")} disabled={saving} />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="p-4 bg-[var(--background)]/30 border-t border-[var(--border)] text-[11px] text-[var(--foreground-muted)] leading-relaxed">
        💡 <strong>Push</strong> nécessite que tu autorises les notifications dans ton navigateur ou l'app
        mobile/desktop. <strong>Email</strong> nécessite que ton adresse soit vérifiée.
      </div>
    </div>
  );
}

// === Sous-composants UI ===

function Toggle({
  on,
  onClick,
  disabled,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      className={`relative w-9 h-5 rounded-full transition-colors ${
        on ? "bg-[var(--accent)]" : "bg-[var(--background-elevated)] border border-[var(--border)]"
      } disabled:opacity-50`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${
          on ? "start-[18px]" : "start-0.5"
        }`}
      />
    </button>
  );
}

function ChannelToggle({
  on,
  onClick,
  icon: Icon,
  label,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${
        on
          ? "bg-[var(--accent)]/20 text-[var(--accent)]"
          : "bg-[var(--background-elevated)] text-[var(--foreground-muted)]"
      }`}
      aria-label={`${label} ${on ? "activé" : "désactivé"}`}
    >
      <Icon className="size-3" />
      {label}
    </button>
  );
}
