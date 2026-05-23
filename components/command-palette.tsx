"use client";

// Command palette style Spotlight / VS Code Cmd+K.
// Raccourci : Ctrl/Cmd+K ouvre, Escape ferme, ↑↓ navigue, Enter sélectionne.
// Recherche fuzzy basique sur le label + la description.

import { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "@/i18n/navigation";
import { formatBytes } from "@/lib/utils";
import {
  Search,
  FolderOpen,
  Users,
  UserCog,
  Share2,
  CreditCard,
  LifeBuoy,
  Settings,
  ShieldCheck,
  Bell,
  Trash2,
  Sparkles,
  LayoutDashboard,
  Rocket,
  Shield,
  Download,
  ArrowRight,
  Star,
  File as FileIcon,
  Folder as FolderIcon,
  Loader2,
} from "lucide-react";

interface Command {
  href: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string[];
  admin?: boolean;
  section: "Navigation" | "Compte" | "Admin" | "Fichiers" | "Dossiers";
}

interface SearchResults {
  files: { id: string; name: string; mimeType: string; size: string; folderId: string | null }[];
  folders: { id: string; name: string; parentId: string | null }[];
}

const COMMANDS: Command[] = [
  // Navigation principale
  { href: "/dashboard", label: "Mon espace", description: "Vue d'ensemble", icon: LayoutDashboard, section: "Navigation" },
  { href: "/files", label: "Mes fichiers", description: "Tous mes documents et photos", icon: FolderOpen, section: "Navigation", keywords: ["documents", "photos"] },
  { href: "/starred", label: "Favoris", description: "Fichiers et dossiers étoilés", icon: Star, section: "Navigation", keywords: ["favoris", "etoile", "star", "starred", "important"] },
  { href: "/family", label: "Famille", description: "Espaces partagés famille", icon: Users, section: "Navigation", keywords: ["team", "equipe"] },
  { href: "/accounts", label: "Sous-comptes", description: "Crée des accès pour ta famille", icon: UserCog, section: "Navigation", keywords: ["sub", "enfants"] },
  { href: "/shares", label: "Mes partages", description: "Liens téléchargeables", icon: Share2, section: "Navigation", keywords: ["wetransfer", "lien", "link"] },
  { href: "/billing", label: "Mon plan", description: "Abonnement, factures, paiements", icon: CreditCard, section: "Navigation", keywords: ["plan", "stripe", "abonnement", "facture"] },
  { href: "/support", label: "Support", description: "Tickets et WhatsApp", icon: LifeBuoy, section: "Navigation", keywords: ["help", "aide", "contact"] },
  { href: "/download", label: "Apps mobile / desktop", description: "Télécharger pour Mac, Windows, Linux, mobile", icon: Download, section: "Navigation", keywords: ["install", "pwa", "webdav"] },
  { href: "/hosting", label: "Hébergement", description: "Sites web + Claude Code (bientôt)", icon: Rocket, section: "Navigation", keywords: ["host", "site"] },

  // Compte
  { href: "/settings", label: "Paramètres", description: "Profil, apparence, langue", icon: Settings, section: "Compte" },
  { href: "/security", label: "Sécurité & activité", description: "Logins, mot de passe, 2FA", icon: ShieldCheck, section: "Compte", keywords: ["2fa", "passkey", "biometrie"] },
  { href: "/notifications", label: "Notifications", icon: Bell, section: "Compte" },
  { href: "/trash", label: "Corbeille", description: "Fichiers supprimés récupérables", icon: Trash2, section: "Compte", keywords: ["delete", "trash"] },

  // Admin
  { href: "/admin", label: "Vue d'ensemble admin", icon: LayoutDashboard, section: "Admin", admin: true },
  { href: "/admin/clients", label: "Clients", icon: Users, section: "Admin", admin: true },
  { href: "/admin/plans", label: "Plans tarifaires", icon: Sparkles, section: "Admin", admin: true },
  { href: "/admin/coupons", label: "Codes promo", icon: Sparkles, section: "Admin", admin: true },
  { href: "/admin/payments", label: "Paiements", icon: CreditCard, section: "Admin", admin: true },
  { href: "/admin/tickets", label: "Tickets support", icon: LifeBuoy, section: "Admin", admin: true },
  { href: "/admin/storage", label: "Stockage", icon: FolderOpen, section: "Admin", admin: true },
  { href: "/admin/staff", label: "Équipe interne", icon: Shield, section: "Admin", admin: true },
  { href: "/admin/cms", label: "CMS landing", icon: Sparkles, section: "Admin", admin: true },
  { href: "/admin/audit", label: "Journal d'audit", icon: ShieldCheck, section: "Admin", admin: true },
];

export function CommandPalette({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [liveResults, setLiveResults] = useState<SearchResults>({ files: [], folders: [] });
  const [searching, setSearching] = useState(false);

  useEffect(() => setMounted(true), []);

  // Raccourci Ctrl/Cmd+K + event custom "mycloud:open-palette" pour
  // déclencher l'ouverture depuis n'importe quel bouton sans store global.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mycloud:open-palette", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mycloud:open-palette", onOpenEvent);
    };
  }, [open]);

  // Reset state quand on ferme
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      // Focus input
      setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [open]);

  // Ferme automatiquement à chaque changement de route
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Recherche fichiers live (debounce 200 ms) — déclenchée à partir de 2 chars.
  // On évite les fetch redondants en abortant les requêtes en cours.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setLiveResults({ files: [], folders: [] });
      setSearching(false);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/files/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) {
          setLiveResults({ files: [], folders: [] });
          return;
        }
        const data: SearchResults = await res.json();
        setLiveResults(data);
      } catch {
        // ignore abort
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  const filtered = useMemo(() => {
    const all = COMMANDS.filter((c) => isAdmin || !c.admin);
    const trimmed = query.trim();
    const baseStatic = !trimmed
      ? all
      : all.filter((c) => {
          const haystack = [c.label, c.description ?? "", ...(c.keywords ?? [])]
            .join(" ")
            .toLowerCase();
          return haystack.includes(trimmed.toLowerCase());
        });
    // Convertit les fichiers / dossiers live en commandes virtuelles
    const liveCommands: Command[] = [
      ...liveResults.folders.map(
        (f): Command => ({
          href: `/files/${f.id}`,
          label: f.name,
          description: "Dossier",
          icon: FolderIcon,
          section: "Dossiers",
        }),
      ),
      ...liveResults.files.map(
        (f): Command => ({
          href: f.folderId ? `/files/${f.folderId}` : `/files`,
          label: f.name,
          description: formatBytes(Number(f.size)) + " · " + (f.mimeType || "Fichier"),
          icon: FileIcon,
          section: "Fichiers",
        }),
      ),
    ];
    return [...baseStatic, ...liveCommands];
  }, [query, isAdmin, liveResults]);

  function onKeyNav(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const cmd = filtered[activeIdx];
      if (cmd) {
        router.push(cmd.href);
        setOpen(false);
      }
    }
  }

  // Groupage par section
  const grouped: Record<string, Command[]> = {};
  for (const c of filtered) {
    (grouped[c.section] = grouped[c.section] ?? []).push(c);
  }

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Trigger discret en haut à droite — peut être ignoré, raccourci clavier suffit */}
      {/* (volontairement pas ajouté de bouton dans le header pour rester clean) */}

      {open && (
        <div
          className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-md flex items-start justify-center pt-[10vh] px-4 animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-[var(--background-elevated)] border border-[var(--border)] rounded-3xl shadow-2xl overflow-hidden animate-slide-down"
          >
            <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
              <Search className="size-5 text-[var(--foreground-muted)] shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIdx(0);
                }}
                onKeyDown={onKeyNav}
                placeholder="Aller à… (Ctrl+K)"
                className="flex-1 bg-transparent outline-none text-base"
                autoFocus
              />
              {searching && (
                <Loader2 className="size-4 text-[var(--foreground-muted)] animate-spin shrink-0" />
              )}
              <kbd className="text-xs rounded bg-[var(--background)] border border-[var(--border)] px-1.5 py-0.5 text-[var(--foreground-muted)] hidden sm:inline">
                Esc
              </kbd>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-[var(--foreground-muted)] py-8">
                  Aucun résultat pour « {query} »
                </p>
              ) : (
                Object.entries(grouped).map(([section, cmds]) => (
                  <div key={section} className="mb-2">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--foreground-muted)] px-2 py-1.5">
                      {section}
                    </p>
                    {cmds.map((cmd, idx) => {
                      const globalIdx = filtered.indexOf(cmd);
                      const active = globalIdx === activeIdx;
                      return (
                        <button
                          key={`${section}-${idx}-${cmd.href}`}
                          onClick={() => {
                            router.push(cmd.href);
                            setOpen(false);
                          }}
                          onMouseEnter={() => setActiveIdx(globalIdx)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-start transition-colors ${
                            active
                              ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                              : "hover:bg-[var(--background-tile)]"
                          }`}
                        >
                          <div
                            className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                              active ? "bg-[var(--accent)]/20" : "bg-[var(--background-tile)]"
                            }`}
                          >
                            <cmd.icon className="size-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{cmd.label}</p>
                            {cmd.description && (
                              <p className="text-xs text-[var(--foreground-muted)] truncate">
                                {cmd.description}
                              </p>
                            )}
                          </div>
                          {active && <ArrowRight className="size-4 shrink-0 rtl:rotate-180" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] text-[var(--foreground-muted)] p-3 border-t border-[var(--border)]">
              <div className="flex items-center gap-3">
                <span>
                  <kbd className="rounded bg-[var(--background)] border border-[var(--border)] px-1 py-0.5">↑↓</kbd>
                  {" navigue"}
                </span>
                <span>
                  <kbd className="rounded bg-[var(--background)] border border-[var(--border)] px-1 py-0.5">↵</kbd>
                  {" sélectionne"}
                </span>
              </div>
              <span>{filtered.length} résultat(s)</span>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
