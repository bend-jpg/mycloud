"use client";

// Checklist de 5 actions à faire pour bien démarrer.
// Affiché sur le dashboard quand au moins une action n'est pas faite.
// Disparaît automatiquement quand tout est complété.

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  Upload,
  Users,
  Lock,
  Smartphone,
  Star,
  Check,
  ChevronRight,
  X,
} from "lucide-react";

interface ChecklistStatus {
  hasFiles: boolean;
  hasFolders: boolean;
  has2fa: boolean;
  hasFamily: boolean;
  hasStarred: boolean;
}

const STORAGE_KEY = "mytitancloud:onboarding-dismissed";

export function OnboardingChecklist({ status }: { status: ChecklistStatus }) {
  const [dismissed, setDismissed] = useState(false);

  // Vérif localStorage au mount
  if (typeof window !== "undefined" && !dismissed) {
    if (window.localStorage.getItem(STORAGE_KEY)) {
      // User a manuellement fermé la checklist — respecte son choix
      return null;
    }
  }
  if (dismissed) return null;

  const items = [
    {
      done: status.hasFiles || status.hasFolders,
      icon: Upload,
      title: "Uploade ton premier fichier",
      desc: "Glisse-dépose une photo ou un PDF dans /files",
      cta: { label: "Aller à mes fichiers", href: "/files" },
    },
    {
      done: status.hasStarred,
      icon: Star,
      title: "Étoile un fichier important",
      desc: "Pour le retrouver d'un clic dans /starred",
      cta: { label: "Mes fichiers", href: "/files" },
    },
    {
      done: status.has2fa,
      icon: Lock,
      title: "Active la 2FA ou un passkey",
      desc: "Protège ton compte contre les hacks",
      cta: { label: "Sécurité", href: "/security" },
    },
    {
      done: status.hasFamily,
      icon: Users,
      title: "Crée un espace famille",
      desc: "Partage des fichiers avec ta famille",
      cta: { label: "Famille", href: "/family" },
    },
    {
      done: false, // pas de moyen direct de détecter ça côté serveur
      icon: Smartphone,
      title: "Installe l'app sur ton téléphone",
      desc: "Accès instantané à tes fichiers + sync photos",
      cta: { label: "Télécharger", href: "/download" },
    },
  ];

  const completedCount = items.filter((i) => i.done).length;
  const isAllDone = completedCount === items.length;

  if (isAllDone) return null;

  function dismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    }
    setDismissed(true);
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent)]/10 via-[var(--background-tile)] to-[var(--secondary)]/5 p-5 sm:p-6 mb-6">
      <div className="pointer-events-none absolute -top-20 -end-20 size-48 rounded-full bg-[var(--accent)]/15 blur-3xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              🚀 Bienvenue — pour bien démarrer
            </h3>
            <p className="text-xs text-[var(--foreground-muted)] mt-1">
              {completedCount}/{items.length} étape(s) complétée(s)
            </p>
          </div>
          <button
            onClick={dismiss}
            className="p-1.5 rounded-lg hover:bg-[var(--background-elevated)] text-[var(--foreground-muted)]"
            title="Masquer cette checklist"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-[var(--background-elevated)] overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--secondary)] transition-all"
            style={{ width: `${(completedCount / items.length) * 100}%` }}
          />
        </div>

        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i}>
              <Link
                href={item.cta.href}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  item.done
                    ? "bg-[var(--success)]/5 opacity-60"
                    : "bg-[var(--background-elevated)] hover:bg-[var(--background-tile)]"
                }`}
              >
                <div
                  className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                    item.done
                      ? "bg-[var(--success)]/15 text-[var(--success)]"
                      : "bg-[var(--accent)]/15 text-[var(--accent)]"
                  }`}
                >
                  {item.done ? <Check className="size-4" /> : <item.icon className="size-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.done ? "line-through" : ""}`}>
                    {item.title}
                  </p>
                  {!item.done && (
                    <p className="text-xs text-[var(--foreground-muted)]">{item.desc}</p>
                  )}
                </div>
                {!item.done && (
                  <ChevronRight className="size-4 text-[var(--foreground-muted)] shrink-0 rtl:rotate-180" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
