import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/utils";
import { Check, X } from "lucide-react";

export default async function AdminPlansPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const plans = await db.plan.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <main className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Plans tarifaires</h1>
        <p className="text-[var(--foreground-muted)] mt-1">
          Les plans visibles par les clients sur la page d&apos;accueil.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {plans.map((p) => (
          <div key={p.id} className="tile cursor-default !min-h-0">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold">{p.name}</h2>
                <p className="text-sm text-[var(--foreground-muted)]">slug : {p.slug}</p>
              </div>
              <div className="text-end">
                <p className="text-xs text-[var(--foreground-muted)]">
                  {p._count.users} client{p._count.users > 1 ? "s" : ""}
                </p>
                {p.highlighted && (
                  <span className="text-xs rounded-full bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-0.5 mt-1 inline-block">
                    Mis en avant
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
              <div>
                <p className="text-xs text-[var(--foreground-muted)]">Stockage</p>
                <p className="font-semibold">{formatBytes(p.storageBytes)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--foreground-muted)]">Membres max</p>
                <p className="font-semibold">{p.maxMembers}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--foreground-muted)]">Mensuel</p>
                <p className="font-semibold">
                  {(p.priceMonthlyEur / 100).toFixed(2)} € · {(p.priceMonthlyUsd / 100).toFixed(2)} $
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--foreground-muted)]">Annuel</p>
                <p className="font-semibold">
                  {(p.priceYearlyEur / 100).toFixed(2)} € · {(p.priceYearlyUsd / 100).toFixed(2)} $
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4 text-xs">
              <span className="flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-1">
                Liens : {p.maxShareLinks} · {p.maxShareDays}j max
              </span>
              <span
                className={`flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-1 ${
                  p.websiteHosting ? "text-[var(--success)]" : "text-[var(--foreground-muted)]"
                }`}
              >
                {p.websiteHosting ? <Check className="size-3" /> : <X className="size-3" />} Sites
              </span>
              <span
                className={`flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-1 ${
                  p.claudeCodeHosting ? "text-[var(--success)]" : "text-[var(--foreground-muted)]"
                }`}
              >
                {p.claudeCodeHosting ? <Check className="size-3" /> : <X className="size-3" />} Claude Code
              </span>
              <span
                className={`flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-1 ${
                  p.active ? "text-[var(--success)]" : "text-[var(--danger)]"
                }`}
              >
                {p.active ? "Actif" : "Désactivé"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-[var(--foreground-muted)]">
        💡 L&apos;éditeur de plans en place sera ajouté en Phase 5 (Stripe sync). En attendant, modifie les plans via{" "}
        <code className="px-1 py-0.5 bg-[var(--background-elevated)] rounded">lib/plans.ts</code> ou directement en DB.
      </p>
    </main>
  );
}
