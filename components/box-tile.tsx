import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";

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
  const accentColor =
    accent === "amber"
      ? "text-[var(--secondary)]"
      : accent === "violet"
      ? "text-violet-400"
      : accent === "green"
      ? "text-emerald-400"
      : "text-[var(--accent)]";

  return (
    <Link href={href} className="tile group">
      <div className="flex items-start justify-between">
        <div className={`tile-icon ${accentColor}`}>{icon}</div>
        {badge && (
          <span className="text-xs rounded-full bg-[var(--background-elevated)] border border-[var(--border)] px-3 py-1 text-[var(--foreground-muted)]">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-auto">
        <h3 className="text-xl font-semibold text-[var(--foreground)]">{title}</h3>
        {description && (
          <p className="text-sm text-[var(--foreground-muted)] mt-1">{description}</p>
        )}
      </div>
    </Link>
  );
}
