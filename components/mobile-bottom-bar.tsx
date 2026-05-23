"use client";

// Bottom tab bar mobile pour les utilisateurs connectés.
// Visible uniquement md:hidden (sous 768px). Donne accès rapide aux
// 4 sections principales sans passer par le burger.
//
// Style inspiré de iOS / Instagram : icônes + label, accent visuel
// sur l'onglet actif, safe-area-inset pour éviter le notch / barre nav.

import { Link, usePathname } from "@/i18n/navigation";
import { FolderOpen, Star, Share2, Users, Home } from "lucide-react";

const TABS = [
  { href: "/dashboard", icon: Home, label: "Accueil", match: (p: string) => p === "/dashboard" },
  { href: "/files", icon: FolderOpen, label: "Fichiers", match: (p: string) => p.startsWith("/files") },
  { href: "/starred", icon: Star, label: "Favoris", match: (p: string) => p.startsWith("/starred") },
  { href: "/family", icon: Users, label: "Famille", match: (p: string) => p.startsWith("/family") },
  { href: "/shares", icon: Share2, label: "Partages", match: (p: string) => p.startsWith("/shares") },
] as const;

export function MobileBottomBar() {
  const pathname = usePathname();

  // On masque sur certaines routes où ça gênerait (admin, auth pages, etc.)
  // (md:hidden gère déjà le desktop, ici on gère les routes spéciales)
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/s/") // page partage publique
  ) {
    return null;
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[var(--background-elevated)]/95 backdrop-blur-xl border-t border-[var(--border)] pb-[env(safe-area-inset-bottom)]"
      aria-label="Navigation rapide"
    >
      <ul className="grid grid-cols-5 gap-0.5 px-1 py-1">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 py-2 rounded-xl transition-colors ${
                  active
                    ? "text-[var(--accent)]"
                    : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <tab.icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
                <span className="text-[10px] font-medium leading-none">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
