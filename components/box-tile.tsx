import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

export function BoxTile({
  href,
  icon,
  title,
  description,
  badge,
  accent,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description?: string;
  badge?: string;
  accent?: "cyan" | "amber" | "violet" | "green";
}) {
  // Mappage couleur → classes Tailwind. On utilise des gradients sur l'icône pour donner du peps.
  const accentClasses = {
    cyan: {
      iconBg: "bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 border-[var(--accent)]/30",
      iconColor: "text-[var(--accent)]",
      gradient: "from-[var(--accent)]/10 via-transparent to-transparent",
      hoverBorder: "group-hover:border-[var(--accent)]/40",
    },
    amber: {
      iconBg: "bg-gradient-to-br from-[var(--secondary)]/20 to-[var(--secondary)]/5 border-[var(--secondary)]/30",
      iconColor: "text-[var(--secondary)]",
      gradient: "from-[var(--secondary)]/10 via-transparent to-transparent",
      hoverBorder: "group-hover:border-[var(--secondary)]/40",
    },
    violet: {
      iconBg: "bg-gradient-to-br from-violet-500/20 to-violet-500/5 border-violet-500/30",
      iconColor: "text-violet-400",
      gradient: "from-violet-500/10 via-transparent to-transparent",
      hoverBorder: "group-hover:border-violet-500/40",
    },
    green: {
      iconBg: "bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
      iconColor: "text-emerald-400",
      gradient: "from-emerald-500/10 via-transparent to-transparent",
      hoverBorder: "group-hover:border-emerald-500/40",
    },
  };
  const a = accentClasses[accent ?? "cyan"];

  return (
    <Link
      href={href}
      className={`relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-5 min-h-[160px] flex flex-col group transition-all hover:scale-[1.02] hover:shadow-xl animate-fade-in-up ${a.hoverBorder}`}
    >
      {/* Gradient overlay */}
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${a.gradient} opacity-0 group-hover:opacity-100 transition-opacity`}
      />
      {/* Blob décoratif */}
      <div className="pointer-events-none absolute -bottom-12 -end-12 size-32 rounded-full bg-white/[0.02] blur-2xl" />

      <div className="relative flex items-start justify-between">
        <div
          className={`size-12 rounded-2xl border flex items-center justify-center ${a.iconBg} ${a.iconColor} group-hover:scale-110 transition-transform`}
        >
          {icon}
        </div>
        {badge && (
          <span className="text-[10px] font-semibold rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 px-2 py-0.5 text-[var(--accent)] uppercase tracking-wide">
            {badge}
          </span>
        )}
      </div>

      <div className="relative mt-auto pt-4">
        <h3 className="text-lg font-semibold text-[var(--foreground)] flex items-center gap-1.5">
          {title}
          <ArrowRight className="size-4 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
        </h3>
        {description && (
          <p className="text-sm text-[var(--foreground-muted)] mt-1 leading-snug">{description}</p>
        )}
      </div>
    </Link>
  );
}
