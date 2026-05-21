// Hero header réutilisable pour les pages user — gradient blob coloré,
// icône dans une box, titre + description, slot CTA à droite.
//
// Usage :
//   <PageHero icon={FolderOpen} variant="cyan" title="..." description="..." cta={...} />

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeroProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  variant?: "cyan" | "amber" | "violet" | "green" | "pink" | "red";
  /** Bouton ou autre élément à afficher en haut-droite */
  cta?: ReactNode;
  /** Bandeau juste avant le titre, ex: stats / breadcrumb (rendu en gros) */
  topSlot?: ReactNode;
}

const VARIANT: Record<string, { from: string; to: string; iconBg: string; iconColor: string; blob1: string; blob2: string }> = {
  cyan: {
    from: "from-[var(--accent)]/10",
    to: "to-[var(--secondary)]/10",
    iconBg: "bg-[var(--accent)]/15 border-[var(--accent)]/30",
    iconColor: "text-[var(--accent)]",
    blob1: "bg-[var(--accent)]/15",
    blob2: "bg-[var(--secondary)]/15",
  },
  amber: {
    from: "from-[var(--secondary)]/10",
    to: "to-yellow-500/10",
    iconBg: "bg-[var(--secondary)]/15 border-[var(--secondary)]/30",
    iconColor: "text-[var(--secondary)]",
    blob1: "bg-[var(--secondary)]/15",
    blob2: "bg-yellow-500/10",
  },
  violet: {
    from: "from-violet-500/10",
    to: "to-pink-500/10",
    iconBg: "bg-violet-500/15 border-violet-500/30",
    iconColor: "text-violet-400",
    blob1: "bg-violet-500/15",
    blob2: "bg-pink-500/10",
  },
  green: {
    from: "from-emerald-500/10",
    to: "to-[var(--accent)]/10",
    iconBg: "bg-emerald-500/15 border-emerald-500/30",
    iconColor: "text-emerald-400",
    blob1: "bg-emerald-500/15",
    blob2: "bg-[var(--accent)]/15",
  },
  pink: {
    from: "from-pink-500/10",
    to: "to-violet-500/10",
    iconBg: "bg-pink-500/15 border-pink-500/30",
    iconColor: "text-pink-400",
    blob1: "bg-pink-500/15",
    blob2: "bg-violet-500/10",
  },
  red: {
    from: "from-[var(--danger)]/10",
    to: "to-[var(--secondary)]/10",
    iconBg: "bg-[var(--danger)]/15 border-[var(--danger)]/30",
    iconColor: "text-[var(--danger)]",
    blob1: "bg-[var(--danger)]/15",
    blob2: "bg-[var(--secondary)]/10",
  },
};

export function PageHero({
  icon: Icon,
  title,
  description,
  variant = "cyan",
  cta,
  topSlot,
}: PageHeroProps) {
  const v = VARIANT[variant] ?? VARIANT.cyan;
  return (
    <div className={`relative overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br ${v.from} via-[var(--background-tile)] ${v.to} p-6 sm:p-8`}>
      <div className={`pointer-events-none absolute -top-16 -end-16 size-64 rounded-full ${v.blob1} blur-3xl`} />
      <div className={`pointer-events-none absolute -bottom-16 -start-16 size-64 rounded-full ${v.blob2} blur-3xl`} />
      <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div className={`size-12 rounded-2xl border ${v.iconBg} ${v.iconColor} flex items-center justify-center shrink-0 shadow-lg`}>
            <Icon className="size-6" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            {topSlot}
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{title}</h1>
            {description && (
              <div className="text-sm text-[var(--foreground-muted)] mt-1.5">{description}</div>
            )}
          </div>
        </div>
        {cta && <div className="shrink-0">{cta}</div>}
      </div>
    </div>
  );
}
