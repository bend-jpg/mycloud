// Empty state réutilisable avec illustration SVG colorée.
// Beaucoup plus accueillant qu'un texte gris au milieu d'une page vide.

import { Link } from "@/i18n/navigation";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  /** Illustration : soit une icône Lucide, soit un SVG custom passé directement */
  icon?: LucideIcon;
  illustration?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  /** Couleur d'accent : "accent" | "secondary" | "success" | "violet" | "pink" */
  variant?: "accent" | "secondary" | "success" | "violet" | "pink";
  cta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryCta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

const VARIANT_GRADIENT: Record<string, string> = {
  accent: "from-[var(--accent)]/30 to-[var(--accent)]/0",
  secondary: "from-[var(--secondary)]/30 to-[var(--secondary)]/0",
  success: "from-[var(--success)]/30 to-[var(--success)]/0",
  violet: "from-violet-500/30 to-violet-500/0",
  pink: "from-pink-500/30 to-pink-500/0",
};

const VARIANT_ICON_COLOR: Record<string, string> = {
  accent: "text-[var(--accent)]",
  secondary: "text-[var(--secondary)]",
  success: "text-[var(--success)]",
  violet: "text-violet-400",
  pink: "text-pink-400",
};

export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  variant = "accent",
  cta,
  secondaryCta,
}: EmptyStateProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--background-tile)] py-14 px-6 text-center">
      {/* Gradient blob en fond */}
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${VARIANT_GRADIENT[variant]} opacity-60`}
      />
      {/* Bulles décoratives */}
      <div className="pointer-events-none absolute -top-12 -end-12 size-40 rounded-full bg-gradient-to-br from-white/5 to-transparent blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -start-12 size-32 rounded-full bg-gradient-to-tr from-white/5 to-transparent blur-2xl" />

      <div className="relative">
        {/* Illustration centrale */}
        <div className="inline-flex items-center justify-center mb-6">
          {illustration ?? (Icon && (
            <div
              className={`size-20 rounded-3xl bg-[var(--background-elevated)] border border-[var(--border)] flex items-center justify-center ${VARIANT_ICON_COLOR[variant]} shadow-lg`}
            >
              <Icon className="size-10" strokeWidth={1.5} />
            </div>
          ))}
        </div>

        <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
        {description && (
          <div className="mt-2 max-w-md mx-auto text-sm text-[var(--foreground-muted)]">
            {description}
          </div>
        )}

        {(cta || secondaryCta) && (
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            {cta &&
              (cta.href ? (
                <Link href={cta.href} className="btn-primary">
                  {cta.label}
                </Link>
              ) : (
                <button onClick={cta.onClick} className="btn-primary">
                  {cta.label}
                </button>
              ))}
            {secondaryCta &&
              (secondaryCta.href ? (
                <Link href={secondaryCta.href} className="btn-ghost text-sm">
                  {secondaryCta.label}
                </Link>
              ) : (
                <button onClick={secondaryCta.onClick} className="btn-ghost text-sm">
                  {secondaryCta.label}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
