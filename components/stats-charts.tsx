// Donut + bar chart 100% SVG, sans lib externe.
// Server components purs (pas de "use client") — données passées en props.

import { formatBytes } from "@/lib/utils";
import type { CategoryStat, MonthBucket } from "@/lib/storage-stats";

// ============================================================
// DONUT — répartition par catégorie
// ============================================================
export function StorageDonut({
  categories,
  totalBytes,
}: {
  categories: CategoryStat[];
  totalBytes: number;
}) {
  if (totalBytes === 0 || categories.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-6 text-center text-sm text-[var(--foreground-muted)]">
        Aucun fichier pour l&apos;instant. Le graphique apparaîtra dès ton premier upload.
      </div>
    );
  }

  // Géométrie : cercle de rayon 70, stroke 22 (donut effect)
  const SIZE = 180;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 70;
  const CIRC = 2 * Math.PI * R;

  // Génère les arcs cumulatifs
  let cumulative = 0;
  const segments = categories.map((cat) => {
    const fraction = cat.bytes / totalBytes;
    const dashLen = fraction * CIRC;
    const dashOffset = CIRC - cumulative;
    cumulative += dashLen;
    return {
      ...cat,
      dashLen,
      dashOffset,
    };
  });

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-5">
      <h3 className="font-semibold text-sm mb-4">Répartition par type</h3>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Donut */}
        <div className="relative shrink-0">
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="-rotate-90"
          >
            {/* Track */}
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="var(--background-elevated)"
              strokeWidth="22"
            />
            {/* Segments */}
            {segments.map((s, i) => (
              <circle
                key={s.category}
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="22"
                strokeDasharray={`${s.dashLen} ${CIRC - s.dashLen}`}
                strokeDashoffset={s.dashOffset}
                style={{ transition: "all 0.4s" }}
              >
                <title>
                  {s.label} — {formatBytes(s.bytes)} ({s.count} fichier(s))
                </title>
              </circle>
            ))}
          </svg>
          {/* Centre du donut */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-xl font-bold">{formatBytes(totalBytes)}</p>
            <p className="text-[10px] text-[var(--foreground-muted)] uppercase tracking-wide">
              total
            </p>
          </div>
        </div>

        {/* Légende */}
        <ul className="flex-1 w-full space-y-2 text-sm">
          {categories.map((cat) => {
            const pct = Math.round((cat.bytes / totalBytes) * 100);
            return (
              <li key={cat.category} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="size-3 rounded-sm shrink-0"
                    style={{ background: cat.color }}
                  />
                  <span className="truncate">{cat.label}</span>
                  <span className="text-xs text-[var(--foreground-muted)] shrink-0">
                    ({cat.count})
                  </span>
                </div>
                <div className="text-end shrink-0">
                  <p className="font-medium text-xs">{formatBytes(cat.bytes)}</p>
                  <p className="text-[10px] text-[var(--foreground-muted)]">{pct}%</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ============================================================
// BAR CHART — uploads par mois (12 mois)
// ============================================================
export function UploadsBarChart({ months }: { months: MonthBucket[] }) {
  const maxCount = Math.max(1, ...months.map((m) => m.count));
  const totalLastYear = months.reduce((sum, m) => sum + m.count, 0);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-5">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h3 className="font-semibold text-sm">Uploads sur 12 mois</h3>
          <p className="text-xs text-[var(--foreground-muted)]">
            {totalLastYear} fichier(s) uploadé(s) cette année
          </p>
        </div>
      </div>

      <div className="flex items-end gap-1.5 h-32">
        {months.map((m) => {
          const pct = (m.count / maxCount) * 100;
          return (
            <div key={m.monthIso} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="flex-1 w-full flex items-end">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-[var(--accent)] to-[var(--secondary)] transition-all hover:opacity-80 relative group"
                  style={{ height: `${pct}%`, minHeight: m.count > 0 ? "4px" : "0" }}
                  title={`${m.label} : ${m.count} fichier(s) · ${formatBytes(m.bytes)}`}
                >
                  {m.count > 0 && (
                    <span className="absolute -top-5 start-1/2 -translate-x-1/2 text-[10px] text-[var(--foreground-muted)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {m.count}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-[var(--foreground-muted)] uppercase">
                {m.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
