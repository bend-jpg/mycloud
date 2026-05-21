// Page admin : toujours dynamique (depend de la session + queries lourdes)
export const dynamic = "force-dynamic";

import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
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
  AlertTriangle,
  UserPlus,
  ChevronRight,
  Activity,
} from "lucide-react";

export default async function AdminHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 86400_000);
  const weekAgo = new Date(now.getTime() - 7 * 86400_000);
  const monthAgo = new Date(now.getTime() - 30 * 86400_000);

  const [
    userCount,
    activeUsers,
    suspendedCount,
    newUsers7d,
    teamCount,
    fileCount,
    shareCount,
    openTickets,
    pendingPayments,
    failedPayments,
    totalStorage,
    payments30d,
    payments7d,
    plans,
    costStats,
    recentSignups,
    recentPayments,
    recentTickets,
    overQuotaUsers,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { suspendedAt: null, role: "USER" } }),
    db.user.count({ where: { NOT: { suspendedAt: null } } }),
    db.user.count({ where: { createdAt: { gte: weekAgo }, role: "USER" } }),
    db.team.count(),
    db.file.count({ where: { isTrash: false } }),
    db.shareLink.count({ where: { revokedAt: null } }),
    db.ticket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_USER"] } } }),
    db.payment.count({ where: { status: "PENDING" } }),
    db.payment.count({ where: { status: "FAILED", createdAt: { gte: monthAgo } } }),
    db.user.aggregate({ _sum: { storageUsed: true } }),
    db.payment.aggregate({
      where: { status: "SUCCEEDED", paidAt: { gte: monthAgo } },
      _sum: { amount: true },
    }),
    db.payment.aggregate({
      where: { status: "SUCCEEDED", paidAt: { gte: weekAgo } },
      _sum: { amount: true },
    }),
    db.plan.findMany({
      select: { id: true, name: true, slug: true, _count: { select: { users: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    globalCostStats(),
    db.user.findMany({
      where: { role: "USER", createdAt: { gte: weekAgo } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    db.payment.findMany({
      where: { status: { in: ["SUCCEEDED", "PENDING"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { name: true, email: true } } },
    }),
    db.ticket.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { openedBy: { select: { name: true, email: true } } },
    }),
    db.$queryRaw<{ id: string; name: string | null; email: string; pct: number }[]>`
      SELECT id, name, email,
             CAST(("storageUsed"::float / NULLIF("storageQuota"::float, 0)) * 100 AS INT) AS pct
      FROM "User"
      WHERE "storageQuota" > 0
        AND "storageUsed"::float / "storageQuota"::float >= 0.9
        AND role = 'USER'
      ORDER BY pct DESC
      LIMIT 5
    `,
  ]);

  // Alertes prioritaires
  const alerts: { kind: "info" | "warning" | "danger"; text: string; href: string }[] = [];
  if (openTickets > 0) {
    alerts.push({
      kind: openTickets > 5 ? "danger" : "warning",
      text: `${openTickets} ticket(s) ouvert(s) à traiter`,
      href: "/admin/tickets",
    });
  }
  if (pendingPayments > 0) {
    alerts.push({
      kind: "warning",
      text: `${pendingPayments} paiement(s) en attente`,
      href: "/admin/payments?status=PENDING",
    });
  }
  if (failedPayments > 0) {
    alerts.push({
      kind: "danger",
      text: `${failedPayments} paiement(s) échoué(s) dans le mois`,
      href: "/admin/payments?status=FAILED",
    });
  }
  if (overQuotaUsers.length > 0) {
    alerts.push({
      kind: "warning",
      text: `${overQuotaUsers.length} client(s) à ≥90% de leur quota`,
      href: "/admin/clients",
    });
  }
  if (costStats.totalMarginMonthlyEur < 0) {
    alerts.push({
      kind: "danger",
      text: `Marge mensuelle négative : ${costStats.totalMarginMonthlyEur.toFixed(2)} €`,
      href: "/admin/storage",
    });
  }

  const stats = [
    { label: "Clients actifs", value: activeUsers.toString(), sub: `${newUsers7d} nouveaux cette semaine`, icon: Users, accent: "text-[var(--accent)]", href: "/admin/clients" },
    { label: "Stockage utilisé", value: formatBytes(Number(totalStorage._sum.storageUsed ?? BigInt(0))), sub: "tous clients", icon: HardDrive, accent: "text-emerald-400", href: "/admin/storage" },
    { label: "Revenu 30j", value: `${((payments30d._sum.amount ?? 0) / 100).toFixed(2)} €`, sub: `${((payments7d._sum.amount ?? 0) / 100).toFixed(2)} € cette semaine`, icon: CreditCard, accent: "text-[var(--secondary)]", href: "/admin/payments" },
    { label: "Tickets ouverts", value: openTickets.toString(), sub: "à traiter", icon: Ticket, accent: openTickets > 0 ? "text-yellow-400" : "text-[var(--foreground-muted)]", href: "/admin/tickets" },
    { label: "Espaces partagés", value: teamCount.toString(), sub: "familles & workspaces", icon: FolderTree, accent: "text-violet-400", href: "/admin/clients" },
    { label: "Liens actifs", value: shareCount.toString(), sub: `${fileCount} fichiers total`, icon: LinkIcon, accent: "text-pink-400", href: "/admin/audit" },
  ];

  const marginColor =
    costStats.totalMarginMonthlyEur >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]";
  const MarginIcon = costStats.totalMarginMonthlyEur >= 0 ? TrendingUp : TrendingDown;

  return (
    <main className="p-4 sm:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Vue d&apos;ensemble</h1>
        <p className="text-[var(--foreground-muted)] mt-1">
          État du SaaS · {now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Alertes prioritaires */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <Link
              key={i}
              href={alert.href}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 hover:scale-[1.005] transition-transform ${
                alert.kind === "danger"
                  ? "bg-[var(--danger)]/10 border-[var(--danger)]/30 text-[var(--danger)]"
                  : alert.kind === "warning"
                  ? "bg-yellow-400/10 border-yellow-400/30 text-yellow-400"
                  : "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="size-5 shrink-0" />
                <p className="text-sm font-medium">{alert.text}</p>
              </div>
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Link>
          ))}
        </div>
      )}

      {/* Bloc rentabilité — mis en avant */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="tile cursor-default !min-h-0">
          <div className="tile-icon text-[var(--success)]">
            <Wallet className="size-6" />
          </div>
          <div className="mt-auto">
            <p className="text-sm text-[var(--foreground-muted)]">Revenu mensuel récurrent</p>
            <p className="text-3xl font-bold mt-1">{costStats.totalRevenueMonthlyEur.toFixed(2)} €</p>
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
            <p className="text-3xl font-bold mt-1">{costStats.totalCostMonthlyEur.toFixed(2)} €</p>
            <p className="text-xs text-[var(--foreground-muted)]">
              {costStats.perBackend.length} backend(s) actif(s)
            </p>
          </div>
        </div>
        <div className="tile cursor-default !min-h-0">
          <div className={`tile-icon ${marginColor}`}>
            <MarginIcon className="size-6" />
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

      {/* Stats secondaires (cliquables) */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Indicateurs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="tile cursor-pointer hover:scale-[1.02] !min-h-32 group"
            >
              <div className={`tile-icon ${stat.accent}`}>
                <stat.icon className="size-6" />
              </div>
              <div className="mt-auto">
                <p className="text-sm text-[var(--foreground-muted)]">{stat.label}</p>
                <p className="text-3xl font-bold mt-1">{stat.value}</p>
                <p className="text-xs text-[var(--foreground-muted)] mt-1">{stat.sub}</p>
              </div>
              <ChevronRight className="absolute top-3 end-3 size-4 text-[var(--foreground-muted)] opacity-0 group-hover:opacity-100 rtl:rotate-180" />
            </Link>
          ))}
        </div>
      </div>

      {/* Activité récente (grille 3 colonnes) */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Activity className="size-5 text-[var(--accent)]" />
          Activité récente
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Nouveaux inscrits */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <UserPlus className="size-4 text-emerald-400" />
                <h3 className="font-semibold text-sm">Nouveaux clients (7j)</h3>
              </div>
              <Link href="/admin/clients" className="text-xs text-[var(--accent)] hover:underline">
                Voir tout
              </Link>
            </div>
            {recentSignups.length === 0 ? (
              <p className="text-xs text-[var(--foreground-muted)] p-6 text-center">
                Personne cette semaine.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {recentSignups.map((u) => (
                  <li key={u.id}>
                    <Link href={`/admin/clients/${u.id}`} className="flex items-center justify-between p-3 hover:bg-[var(--background-elevated)]">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{u.name ?? "—"}</p>
                        <p className="text-xs text-[var(--foreground-muted)] truncate">{u.email}</p>
                      </div>
                      <span className="text-xs text-[var(--foreground-muted)] shrink-0 ms-2">
                        {relativeTime(u.createdAt, locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Derniers paiements */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-[var(--secondary)]" />
                <h3 className="font-semibold text-sm">Derniers paiements</h3>
              </div>
              <Link href="/admin/payments" className="text-xs text-[var(--accent)] hover:underline">
                Voir tout
              </Link>
            </div>
            {recentPayments.length === 0 ? (
              <p className="text-xs text-[var(--foreground-muted)] p-6 text-center">
                Aucun paiement.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {recentPayments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between p-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {(p.amount / 100).toFixed(2)} {p.currency}
                      </p>
                      <p className="text-xs text-[var(--foreground-muted)] truncate">
                        {p.user.name ?? p.user.email}
                      </p>
                    </div>
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 shrink-0 ms-2 ${
                        p.status === "SUCCEEDED"
                          ? "text-[var(--success)] bg-[var(--success)]/10"
                          : "text-yellow-400 bg-yellow-400/10"
                      }`}
                    >
                      {p.status === "SUCCEEDED" ? "OK" : "En attente"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Tickets en cours */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Ticket className="size-4 text-yellow-400" />
                <h3 className="font-semibold text-sm">Tickets en cours</h3>
              </div>
              <Link href="/admin/tickets" className="text-xs text-[var(--accent)] hover:underline">
                Voir tout
              </Link>
            </div>
            {recentTickets.length === 0 ? (
              <p className="text-xs text-[var(--foreground-muted)] p-6 text-center">
                Tout est traité 🎉
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {recentTickets.map((t) => (
                  <li key={t.id}>
                    <Link href={`/admin/tickets/${t.id}`} className="flex items-center justify-between p-3 hover:bg-[var(--background-elevated)]">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.subject}</p>
                        <p className="text-xs text-[var(--foreground-muted)] truncate">
                          {t.openedBy.name ?? t.openedBy.email}
                        </p>
                      </div>
                      <span className="text-xs text-[var(--foreground-muted)] shrink-0 ms-2">
                        {relativeTime(t.updatedAt, locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Coûts par backend */}
      {costStats.perBackend.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Coûts par backend de stockage</h2>
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
        <h2 className="text-lg font-semibold mb-3">Répartition par plan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {plans.map((p) => (
            <Link
              key={p.id}
              href={`/admin/clients?plan=${p.slug}`}
              className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-4 hover:bg-[var(--background-elevated)] transition-colors"
            >
              <p className="text-sm text-[var(--foreground-muted)]">{p.name}</p>
              <p className="text-2xl font-bold mt-1">{p._count.users}</p>
              <p className="text-xs text-[var(--foreground-muted)]">clients</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Petit récap utilisateurs suspendus si > 0 */}
      {suspendedCount > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-4 text-sm text-[var(--foreground-muted)]">
          <p>
            <strong className="text-[var(--foreground)]">{suspendedCount}</strong> compte(s) suspendu(s).{" "}
            <Link href="/admin/clients" className="text-[var(--accent)] hover:underline">
              Voir la liste →
            </Link>
          </p>
        </div>
      )}
    </main>
  );
}

// Helper : "il y a 3h"
function relativeTime(d: Date, locale: string): string {
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `il y a ${days}j`;
  return d.toLocaleDateString(locale);
}
