import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/utils";
import { globalCostStats } from "@/lib/cost-stats";
import {
  Users,
  HardDrive,
  CreditCard,
  Ticket,
  FolderTree,
  Link as LinkIcon,
  TrendingUp,
  TrendingDown,
  Wallet,
} from "lucide-react";

export default async function AdminHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [
    userCount,
    activeUsers,
    teamCount,
    fileCount,
    shareCount,
    openTickets,
    totalStorage,
    payments,
    plans,
    costStats,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { suspendedAt: null } }),
    db.team.count(),
    db.file.count({ where: { isTrash: false } }),
    db.shareLink.count({ where: { revokedAt: null } }),
    db.ticket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_USER"] } } }),
    db.user.aggregate({ _sum: { storageUsed: true } }),
    db.payment.aggregate({
      where: { status: "SUCCEEDED", paidAt: { gte: new Date(Date.now() - 30 * 86400_000) } },
      _sum: { amount: true },
    }),
    db.plan.findMany({
      select: { id: true, name: true, slug: true, _count: { select: { users: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    globalCostStats(),
  ]);

  const stats = [
    {
      label: "Clients actifs",
      value: activeUsers,
      sub: `${userCount} total`,
      icon: Users,
      accent: "text-[var(--accent)]",
    },
    {
      label: "Stockage utilisé",
      value: formatBytes(Number(totalStorage._sum.storageUsed ?? BigInt(0))),
      sub: "tous clients",
      icon: HardDrive,
      accent: "text-emerald-400",
    },
    {
      label: "Revenu 30 jours",
      value: `${((payments._sum.amount ?? 0) / 100).toFixed(2)} €`,
      sub: "payments encaissés",
      icon: CreditCard,
      accent: "text-[var(--secondary)]",
    },
    {
      label: "Tickets ouverts",
      value: openTickets,
      sub: "à traiter",
      icon: Ticket,
      accent: openTickets > 0 ? "text-yellow-400" : "text-[var(--foreground-muted)]",
    },
    {
      label: "Espaces partagés",
      value: teamCount,
      sub: "familles & workspaces",
      icon: FolderTree,
      accent: "text-violet-400",
    },
    {
      label: "Liens actifs",
      value: shareCount,
      sub: `${fileCount} fichiers total`,
      icon: LinkIcon,
      accent: "text-pink-400",
    },
  ];

  const marginColor =
    costStats.totalMarginMonthlyEur >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]";
  const marginIcon = costStats.totalMarginMonthlyEur >= 0 ? TrendingUp : TrendingDown;

  return (
    <main className="p-4 sm:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Vue d&apos;ensemble</h1>
        <p className="text-[var(--foreground-muted)] mt-1">État du SaaS en temps réel.</p>
      </div>

      {/* Bloc rentabilité — mis en avant */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="tile cursor-default !min-h-0">
          <div className="tile-icon text-[var(--success)]">
            <Wallet className="size-6" />
          </div>
          <div className="mt-auto">
            <p className="text-sm text-[var(--foreground-muted)]">Revenu mensuel récurrent</p>
            <p className="text-3xl font-bold mt-1">
              {costStats.totalRevenueMonthlyEur.toFixed(2)} €
            </p>
            <p className="text-xs text-[var(--foreground-muted)]">
              {costStats.activeSubscriptions} abonnement(s) actif(s)
            </p>
          </div>
        </div>
        <div className="tile cursor-default !min-h-0">
          <div className="tile-icon text-[var(--danger)]">
            <HardDrive className="size-6" />
          </div>
          <div className="mt-auto">
            <p className="text-sm text-[var(--foreground-muted)]">Coût stockage mensuel</p>
            <p className="text-3xl font-bold mt-1">
              {costStats.totalCostMonthlyEur.toFixed(2)} €
            </p>
            <p className="text-xs text-[var(--foreground-muted)]">
              {costStats.perBackend.length} backend(s) actif(s)
            </p>
          </div>
        </div>
        <div className="tile cursor-default !min-h-0">
          <div className={`tile-icon ${marginColor}`}>
            {(() => {
              const Icon = marginIcon;
              return <Icon className="size-6" />;
            })()}
          </div>
          <div className="mt-auto">
            <p className="text-sm text-[var(--foreground-muted)]">Marge brute mensuelle</p>
            <p className={`text-3xl font-bold mt-1 ${marginColor}`}>
              {costStats.totalMarginMonthlyEur.toFixed(2)} €
            </p>
            <p className="text-xs text-[var(--foreground-muted)]">
              {costStats.totalRevenueMonthlyEur > 0
                ? `${Math.round((costStats.totalMarginMonthlyEur / costStats.totalRevenueMonthlyEur) * 100)}% de marge`
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Stats secondaires */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="tile cursor-default !min-h-32">
            <div className={`tile-icon ${stat.accent}`}>
              <stat.icon className="size-6" />
            </div>
            <div className="mt-auto">
              <p className="text-sm text-[var(--foreground-muted)]">{stat.label}</p>
              <p className="text-3xl font-bold mt-1">{stat.value}</p>
              <p className="text-xs text-[var(--foreground-muted)] mt-1">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Coûts par backend */}
      {costStats.perBackend.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Coûts par backend de stockage</h2>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--background-elevated)] text-[var(--foreground-muted)] text-xs uppercase">
                <tr>
                  <th className="text-start px-4 py-3">Backend</th>
                  <th className="text-start px-4 py-3">Type</th>
                  <th className="text-end px-4 py-3">Stockage</th>
                  <th className="text-end px-4 py-3">Coût mensuel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {costStats.perBackend.map((b) => (
                  <tr key={b.backendId}>
                    <td className="px-4 py-3 font-medium">{b.name}</td>
                    <td className="px-4 py-3 text-xs">{b.type}</td>
                    <td className="px-4 py-3 text-end">{formatBytes(b.bytes)}</td>
                    <td className="px-4 py-3 text-end font-semibold">{b.costEur.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold mb-4">Répartition par plan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {plans.map((p) => (
            <div key={p.id} className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-4">
              <p className="text-sm text-[var(--foreground-muted)]">{p.name}</p>
              <p className="text-2xl font-bold mt-1">{p._count.users}</p>
              <p className="text-xs text-[var(--foreground-muted)]">clients</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
