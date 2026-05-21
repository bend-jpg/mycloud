"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LogIn,
  LogOut,
  KeyRound,
  Smartphone,
  Fingerprint,
  Download,
  Eye,
  UserCog,
  Mail,
  Trash2,
  Loader2,
  Globe,
} from "lucide-react";

interface ActivityItem {
  id: string;
  action: string;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const ACTION_META: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  login: { icon: LogIn, label: "Connexion", color: "text-[var(--success)] bg-[var(--success)]/10" },
  "login.failed": { icon: LogIn, label: "Tentative échouée", color: "text-[var(--danger)] bg-[var(--danger)]/10" },
  logout: { icon: LogOut, label: "Déconnexion", color: "text-[var(--foreground-muted)] bg-[var(--background-elevated)]" },
  "password.change": { icon: KeyRound, label: "Mot de passe changé", color: "text-yellow-400 bg-yellow-400/10" },
  "email.change": { icon: Mail, label: "Email modifié", color: "text-yellow-400 bg-yellow-400/10" },
  "twofa.enable": { icon: Smartphone, label: "2FA activée", color: "text-[var(--accent)] bg-[var(--accent)]/10" },
  "twofa.disable": { icon: Smartphone, label: "2FA désactivée", color: "text-[var(--danger)] bg-[var(--danger)]/10" },
  "passkey.add": { icon: Fingerprint, label: "Passkey ajoutée", color: "text-[var(--accent)] bg-[var(--accent)]/10" },
  "passkey.remove": { icon: Fingerprint, label: "Passkey supprimée", color: "text-[var(--foreground-muted)] bg-[var(--background-elevated)]" },
  "account.update": { icon: UserCog, label: "Profil modifié", color: "text-[var(--accent)] bg-[var(--accent)]/10" },
  "share.view": { icon: Eye, label: "Lien partagé consulté", color: "text-violet-400 bg-violet-400/10" },
  "share.download": { icon: Download, label: "Fichier partagé téléchargé", color: "text-[var(--secondary)] bg-[var(--secondary)]/10" },
};

export function ActivityLogList({ items }: { items: ActivityItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function clearAll() {
    if (!confirm("Effacer tout l'historique d'activité ? (les futures connexions seront à nouveau enregistrées)")) return;
    setBusy(true);
    await fetch("/api/me/activity", { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="text-center text-[var(--foreground-muted)] py-16">
        <p className="text-base">Aucune activité enregistrée pour l&apos;instant.</p>
        <p className="text-sm mt-1">Les connexions, partages téléchargés et changements de sécurité apparaîtront ici.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end">
        <button onClick={clearAll} disabled={busy} className="btn-ghost text-xs !text-[var(--danger)]">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          Effacer tout l&apos;historique
        </button>
      </div>

      <ul className="space-y-2">
        {items.map((a) => {
          const meta = ACTION_META[a.action] ?? {
            icon: Globe,
            label: a.action,
            color: "text-[var(--foreground-muted)] bg-[var(--background-elevated)]",
          };
          const Icon = meta.icon;
          const browser = parseBrowser(a.userAgent);
          return (
            <li
              key={a.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-4 flex items-start gap-3"
            >
              <div className={`shrink-0 size-10 rounded-xl flex items-center justify-center ${meta.color}`}>
                <Icon className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm">{meta.label}</p>
                  <span className="text-xs text-[var(--foreground-muted)] shrink-0">
                    {new Date(a.createdAt).toLocaleString()}
                  </span>
                </div>
                {(a.ip || browser) && (
                  <p className="text-xs text-[var(--foreground-muted)] mt-1 flex flex-wrap items-center gap-3">
                    {a.ip && (
                      <span className="inline-flex items-center gap-1">
                        <Globe className="size-3" />
                        {a.ip}
                      </span>
                    )}
                    {browser && <span>{browser}</span>}
                  </p>
                )}
                {a.metadata && Object.keys(a.metadata).length > 0 && (
                  <p className="text-xs text-[var(--foreground-muted)] mt-1 font-mono">
                    {Object.entries(a.metadata)
                      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
                      .join(" · ")}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Petit parser maison du User-Agent pour afficher quelque chose de lisible. */
function parseBrowser(ua: string | null): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
    ? "Opera"
    : /Firefox\//.test(ua)
    ? "Firefox"
    : /Chrome\//.test(ua)
    ? "Chrome"
    : /Safari\//.test(ua)
    ? "Safari"
    : null;
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Macintosh|Mac OS X/.test(ua)
    ? "macOS"
    : /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iOS/.test(ua)
    ? "iOS"
    : /Linux/.test(ua)
    ? "Linux"
    : null;
  if (!browser && !os) return null;
  return [browser, os].filter(Boolean).join(" · ");
}
