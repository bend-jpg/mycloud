"use client";

// Gros bouton de téléchargement direct affiché dans le hero du landing.
// Détecte l'OS du visiteur et propose l'installeur correspondant en 1 clic.
// Si l'OS est inconnu, on propose toutes les options dans un dropdown.

import { useEffect, useState } from "react";
import {
  Download,
  Apple,
  Monitor,
  Smartphone,
  Terminal,
  ChevronDown,
} from "lucide-react";

type OS = "ios" | "android" | "macos" | "windows" | "linux" | "unknown";

// Les boutons pointent vers /api/dl/[os] qui redirige vers la bonne URL
// (configurée via env var DOWNLOAD_URL_*) ou montre une page friendly si
// pas encore configurée (au lieu de 404 GitHub privé).

function detectOS(): OS {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Mac/.test(ua) && !/iPhone|iPad/.test(ua)) return "macos";
  if (/Windows/.test(ua)) return "windows";
  if (/Linux/.test(ua)) return "linux";
  return "unknown";
}

export function HeroDownloadButton() {
  const [os, setOs] = useState<OS>("unknown");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setOs(detectOS());
  }, []);

  // Bouton principal selon l'OS détecté
  const primary = getPrimaryOption(os);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-stretch gap-0 rounded-full shadow-[0_12px_32px_-8px_var(--accent-glow)]">
        <a
          href={primary.href}
          target={primary.external ? "_blank" : undefined}
          rel={primary.external ? "noopener noreferrer" : undefined}
          className="btn-primary !px-6 sm:!px-8 !py-4 text-base !rounded-r-none border-r border-[var(--accent-foreground)]/15"
        >
          <Download className="size-5" />
          {primary.label}
        </a>
        {/* Bouton dropdown pour choisir un autre OS */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="btn-primary !px-3 !py-4 !rounded-l-none"
          aria-label="Autres plateformes"
          aria-expanded={menuOpen}
        >
          <ChevronDown className={`size-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {menuOpen && (
        <div
          className="absolute mt-16 z-30 rounded-2xl border border-[var(--border)] bg-[var(--background-elevated)] shadow-2xl p-2 grid grid-cols-2 gap-1 w-72"
          onMouseLeave={() => setMenuOpen(false)}
        >
          {ALL_OPTIONS.filter((o) => o.os !== os).map((opt) => (
            <a
              key={opt.os}
              href={opt.href}
              target={opt.external ? "_blank" : undefined}
              rel={opt.external ? "noopener noreferrer" : undefined}
              className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl hover:bg-[var(--background-tile)] text-sm"
            >
              <opt.icon className="size-5 text-[var(--accent)]" />
              <span className="font-medium text-xs">{opt.platformLabel}</span>
              <span className="text-[10px] text-[var(--foreground-muted)]">{opt.formatLabel}</span>
            </a>
          ))}
        </div>
      )}

      <p className="text-[11px] text-[var(--foreground-muted)] text-center max-w-xs">
        Gratuit · Sans inscription pour télécharger · Tu te connectes au 1er lancement
      </p>
    </div>
  );
}

// =================================================================
// Options par plateforme
// =================================================================
interface Option {
  os: OS;
  label: string;
  platformLabel: string;
  formatLabel: string;
  href: string;
  external: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

const ALL_OPTIONS: Option[] = [
  {
    os: "windows",
    label: "Télécharger pour Windows",
    platformLabel: "Windows",
    formatLabel: ".exe (installeur)",
    href: "/api/dl/win",
    external: false,
    icon: Monitor,
  },
  {
    os: "macos",
    label: "Télécharger pour Mac",
    platformLabel: "macOS",
    formatLabel: ".dmg (Intel + M1/M2)",
    href: "/api/dl/mac",
    external: false,
    icon: Apple,
  },
  {
    os: "linux",
    label: "Télécharger pour Linux",
    platformLabel: "Linux",
    formatLabel: ".AppImage / .deb",
    href: "/api/dl/linux",
    external: false,
    icon: Terminal,
  },
  {
    os: "android",
    label: "Télécharger pour Android",
    platformLabel: "Android",
    formatLabel: ".apk (Play Store bientôt)",
    href: "/api/dl/android",
    external: false,
    icon: Smartphone,
  },
  {
    os: "ios",
    label: "iPhone — voir détails",
    platformLabel: "iPhone / iPad",
    formatLabel: "Voir instructions",
    href: "/download",
    external: false,
    icon: Apple,
  },
];

function getPrimaryOption(os: OS): Option {
  const found = ALL_OPTIONS.find((o) => o.os === os);
  if (found) return found;
  // Fallback : si l'OS est unknown, on propose Windows par défaut + dropdown ouvre
  return {
    ...ALL_OPTIONS[0],
    label: "Télécharger l'app",
  };
}
