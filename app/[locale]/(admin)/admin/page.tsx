// Vue d'ensemble admin — refonte complète avec design moderne.
// Layout : hero compact + 4 KPI cards + activité + plans + suspendus.

export const dynamic = "force-dynamic";

import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/utils";
import { globalCostStats } from "@/lib/cost-stats";
import { guardAdminPage } from "@/lib/admin-guard";
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
  ArrowRight,
  Activity,
  Sparkles,
  Calendar,
  CheckCircle2,
} from "lucide-react";

export default async function AdminHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Autorisation AVANT toute requête. Le garde du layout ne protège pas :
  // Next rend layout et page en parallèle, donc sans ce contrôle la page
  // interroge la base et ses données partent dans la réponse malgré la
  // redirection. Vérifié en production sur /admin/storage.
  await guardAdminPage("page.overview", locale);

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 86400_000);
  const weekAgo = new Date(now.getTime() - 7 * 86400_000);
  const monthAgo = new Date(now.getTime() - 30 * 86400_000);

  const [
    userCount,
    activeUsers,
    suspendedCount,
    newUsers7d,
    newUsers24h,
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
    db.user.count({ where: { createdAt: { gte: dayAgo }, role: "USER" } }),
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
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { users: true } } },
    }),
    globalCostStats(),
    db.user.findMany({
      where: { createdAt: { gte: weekAgo }, role: "USER" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    db.payment.findMany({
      where: { createdAt: { gte: monthAgo } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        method: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    db.ticket.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        number: true,
        subject: true,
        priority: true,
        updatedAt: true,
        openedBy: { select: { name: true, email: true } },
      },
    }),
    db.user.findMany({
      where: {
        suspendedAt: null,
        role: "USER",
        storageQuota: { gt: 0 },
      },
      select: { id: true, name: true, email: true, storageUsed: true, storageQuota: true },
      take: 1000,
    }).then((users) =>
      users.filter((u) => Number(u.storageUsed) / Number(u.storageQuota) >= 0.9),
    ),
  ]);

  // ============================================================
  // Alertes : ce qui mérite l'attention immédiate
  // ============================================================
  const alerts: { kind: "danger" | "warning" | "info"; text: string; href: string }[] = [];
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
      text: `${failedPayments} paiement(s) échoué(s) ce mois`,
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

  const revenue30d = (payments30d._sum.amount ?? 0) / 100;
  const revenue7d = (payments7d._sum.amount ?? 0) / 100;
  const totalStorageBytes = Number(totalStorage._sum.storageUsed ?? BigInt(0));
  const margin = costStats.totalMarginMonthlyEur;
  const marginPct =
    costStats.totalRevenueMonthlyEur > 0
      ? Math.round((margin / costStats.totalRevenueMonthlyEur) * 100)
      : 0;

  // Fusion activité récente — tri par date
  type ActivityItem = {
    id: string;
    type: "signup" | "payment" | "ticket";
    title: string;
    subtitle: string;
    href: string;
    date: Date;
    accent: string;
  };
  const activityFeed: ActivityItem[] = [
    ...recentSignups.map((u) => ({
      id: `signup-${u.id}`,
      type: "signup" as const,
      title: u.name ?? u.email,
      subtitle: "Nouveau client inscrit",
      href: `/admin/clients/${u.id}`,
      date: u.createdAt,
      accent: "emerald",
    })),
    ...recentPayments.map((p) => ({
      id: `payment-${p.id}`,
      type: "payment" as const,
      title: `${(p.amount / 100).toFixed(2)} ${p.currency} · ${p.user.name ?? p.user.email}`,
      subtitle: p.status === "SUCCEEDED" ? `Paiement reçu (${p.method})` : `Paiement ${p.status.toLowerCase()}`,
      href: "/admin/payments",
      date: p.createdAt,
      accent: p.status === "SUCCEEDED" ? "amber" : "red",
    })),
    ...recentTickets.map((t) => ({
      id: `ticket-${t.id}`,
      type: "ticket" as const,
      title: t.subject,
      subtitle: `Ticket #${t.number} · ${t.openedBy.name ?? t.openedBy.email}`,
      href: `/admin/tickets/${t.id}`,
      date: t.updatedAt,
      accent: t.priority === "URGENT" || t.priority === "HIGH" ? "red" : "blue",
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 12);

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ============ HERO COMPACT ============ */}
      <header className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent)]/15 via-[var(--background-tile)] to-[var(--secondary)]/10 p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-16 -end-16 size-48 rounded-full bg-[var(--accent)]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -start-16 size-48 rounded-full bg-[var(--secondary)]/15 blur-3xl" />

        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-wider flex items-center gap-2">
              <Calendar className="size-3" />
              {now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold mt-2 leading-tight">
              Vue d&apos;ensemble
            </h1>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">
              {activeUsers} clients actifs · {teamCount} espaces partagés · {fileCount.toLocaleString("fr-FR")} fichiers stockés
            </p>
          </div>

          {/* Mini stat inline : nouveaux aujourd'hui */}
          {newUsers24h > 0 && (
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/30 px-4 py-2 text-sm font-semibold">
              <Sparkles className="size-4" />
              +{newUsers24h} aujourd&apos;hui
            </div>
          )}
        </div>
      </header>

      {/* ============ ALERTES ============ */}
      {alerts.length > 0 && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {alerts.map((alert, i) => (
            <Link
              key={i}
              href={alert.href}
              className={`group flex items-center justify-between rounded-2xl border-2 px-4 py-3 hover:scale-[1.01] transition-transform ${
                alert.kind === "danger"
                  ? "bg-[var(--danger)]/10 border-[var(--danger)]/30 text-[var(--danger)]"
                  : alert.kind === "warning"
                  ? "bg-yellow-400/10 border-yellow-400/30 text-yellow-400"
                  : "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <AlertTriangle className="size-5 shrink-0" />
                <p className="text-sm font-medium truncate">{alert.text}</p>
              </div>
              <ArrowRight className="size-4 shrink-0 rtl:rotate-180 opacity-50 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </section>
      )}

      {/* ============ 4 KPI PRINCIPAUX ============ */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* MRR */}
        <KpiCard
          icon={Wallet}
          label="Revenu mensuel"
          value={`${costStats.totalRevenueMonthlyEur.toFixed(0)} €`}
          sub={`${costStats.activeSubscriptions} abo · ${revenue7d.toFixed(0)} € cette semaine`}
          accent="emerald"
          href="/admin/payments"
          big
        />
        {/* Marge */}
        <KpiCard
          icon={margin >= 0 ? TrendingUp : TrendingDown}
          label="Marge brute"
          value={`${margin.toFixed(0)} €`}
          sub={costStats.totalRevenueMonthlyEur > 0 ? `${marginPct}% du revenu` : "—"}
          accent={margin >= 0 ? "success" : "red"}
          href="/admin/storage"
          big
        />
        {/* Clients */}
        <KpiCard
          icon={Users}
          label="Clients actifs"
          value={activeUsers.toString()}
          sub={`+${newUsers7d} cette semaine`}
          accent="accent"
          href="/admin/clients"
        />
        {/* Stockage */}
        <KpiCard
          icon={HardDrive}
          label="Stockage total"
          value={formatBytes(totalStorageBytes)}
          sub={`${costStats.perBackend.length} backend(s)`}
          accent="violet"
          href="/admin/storage"
        />
      </section>

      {/* ============ 4 KPI SECONDAIRES (compact) ============ */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <CompactStat
          icon={Ticket}
          label="Tickets ouverts"
          value={openTickets}
          accent={openTickets > 0 ? "amber" : "muted"}
          href="/admin/tickets"
        />
        <CompactStat
          icon={FolderTree}
          label="Espaces partagés"
          value={teamCount}
          accent="violet"
          href="/admin/clients"
        />
        <CompactStat
          icon={LinkIcon}
          label="Liens actifs"
          value={shareCount}
          accent="pink"
          href="/admin/audit"
        />
        <CompactStat
          icon={CreditCard}
          label="Revenu 30j"
          value={`${revenue30d.toFixed(0)} €`}
          accent="amber"
          href="/admin/payments"
        />
      </section>

      {/* ============ ACTIVITÉ + RÉPARTITION PAR PLAN ============ */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activité unifiée (2 colonnes) */}
        <div className="lg:col-span-2 rounded-3xl border border-[var(--border)] bg-[var(--background-tile)] overflow-hidden">
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--border)]">
            <h2 className="font-semibold flex items-center gap-2">
              <Activity className="size-5 text-[var(--accent)]" />
              Activité récente
            </h2>
            <span className="text-xs text-[var(--foreground-muted)]">{activityFeed.length} derniers</span>
          </div>
          {activityFeed.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="size-10 text-[var(--foreground-muted)] mx-auto mb-2 opacity-50" />
              <p className="text-sm text-[var(--foreground-muted)]">Rien à signaler récemment.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {activityFeed.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 p-3 sm:p-4 hover:bg-[var(--background-elevated)] transition-colors"
                  >
                    <ActivityIcon type={item.type} accent={item.accent} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-[var(--foreground-muted)] truncate">{item.subtitle}</p>
                    </div>
                    <span className="text-xs text-[var(--foreground-muted)] shrink-0">
                      {relativeTime(item.date, locale)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Répartition par plan (1 colonne) */}
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--background-tile)] overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[var(--border)]">
            <h2 className="font-semibold">Répartition par plan</h2>
            <p className="text-xs text-[var(--foreground-muted)] mt-1">
              {plans.reduce((sum, p) => sum + p._count.users, 0)} clients sur {plans.length} plans
            </p>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {plans.map((p) => {
              const total = plans.reduce((sum, pp) => sum + pp._count.users, 0);
              const pct = total > 0 ? Math.round((p._count.users / total) * 100) : 0;
              return (
                <li key={p.id}>
                  <Link
                    href={`/admin/clients?plan=${p.slug}`}
                    className="block p-3 sm:p-4 hover:bg-[var(--background-elevated)] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-sm font-bold">{p._count.users}</p>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--background-elevated)] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--secondary)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-[var(--foreground-muted)] mt-1">{pct}%</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ============ COÛTS PAR BACKEND ============ */}
      {costStats.perBackend.length > 0 && (
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--background-tile)] overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[var(--border)] flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Coûts par backend de stockage</h2>
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                Total mensuel : <strong className="text-[var(--danger)]">{costStats.totalCostMonthlyEur.toFixed(2)} €</strong>
              </p>
            </div>
            <Link href="/admin/storage" className="btn-ghost !px-3 !py-1.5 text-xs">
              Gérer
              <ArrowRight className="size-3 rtl:rotate-180" />
            </Link>
          </div>
          <div className="overflow-x-auto">
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
                  <tr key={b.backendId} className="hover:bg-[var(--background-elevated)]">
                    <td className="px-4 py-3 font-medium">{b.name}</td>
                    <td className="px-4 py-3 text-xs text-[var(--foreground-muted)]">{b.type}</td>
                    <td className="px-4 py-3 text-end">{formatBytes(b.bytes)}</td>
                    <td className="px-4 py-3 text-end font-semibold">{b.costEur.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ============ COMPTES SUSPENDUS ============ */}
      {suspendedCount > 0 && (
        <Link
          href="/admin/clients?status=suspended"
          className="block rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-4 hover:border-[var(--danger)]/40 transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm">
              <strong className="text-[var(--danger)]">{suspendedCount}</strong> compte(s) suspendu(s)
            </p>
            <span className="text-xs text-[var(--accent)]">Voir la liste →</span>
          </div>
        </Link>
      )}
    </main>
  );
}

// ============================================================
// Sous-composants
// ============================================================

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  href,
  big = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  accent: "emerald" | "success" | "red" | "accent" | "violet" | "amber";
  href: string;
  big?: boolean;
}) {
  const accentMap: Record<string, { bg: string; text: string; ring: string }> = {
    emerald: { bg: "bg-emerald-500/15", text: "text-emerald-400", ring: "from-emerald-500/15" },
    success: { bg: "bg-[var(--success)]/15", text: "text-[var(--success)]", ring: "from-[var(--success)]/15" },
    red: { bg: "bg-[var(--danger)]/15", text: "text-[var(--danger)]", ring: "from-[var(--danger)]/15" },
    accent: { bg: "bg-[var(--accent)]/15", text: "text-[var(--accent)]", ring: "from-[var(--accent)]/15" },
    violet: { bg: "bg-violet-500/15", text: "text-violet-400", ring: "from-violet-500/15" },
    amber: { bg: "bg-[var(--secondary)]/15", text: "text-[var(--secondary)]", ring: "from-[var(--secondary)]/15" },
  };
  const c = accentMap[accent] ?? accentMap.accent;
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br ${c.ring} via-[var(--background-tile)] to-transparent p-4 sm:p-5 hover:scale-[1.02] hover:border-[var(--border-hover)] transition-all`}
    >
      <div className="flex items-start justify-between">
        <div className={`size-10 rounded-2xl ${c.bg} ${c.text} flex items-center justify-center shrink-0`}>
          <Icon className="size-5" />
        </div>
        <ArrowRight className={`size-4 ${c.text} opacity-0 group-hover:opacity-100 transition-opacity rtl:rotate-180`} />
      </div>
      <div className="mt-3">
        <p className="text-xs text-[var(--foreground-muted)]">{label}</p>
        <p className={`font-bold mt-1 ${big ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"}`}>{value}</p>
        <p className="text-[11px] text-[var(--foreground-muted)] mt-1 truncate">{sub}</p>
      </div>
    </Link>
  );
}

function CompactStat({
  icon: Icon,
  label,
  value,
  accent,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  accent: "amber" | "violet" | "pink" | "muted";
  href: string;
}) {
  const colorMap: Record<string, string> = {
    amber: "text-[var(--secondary)]",
    violet: "text-violet-400",
    pink: "text-pink-400",
    muted: "text-[var(--foreground-muted)]",
  };
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-3 sm:p-4 hover:border-[var(--border-hover)] transition-colors flex items-center gap-3"
    >
      <Icon className={`size-5 shrink-0 ${colorMap[accent]}`} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--foreground-muted)] truncate">{label}</p>
        <p className="text-base font-bold">{value}</p>
      </div>
    </Link>
  );
}

function ActivityIcon({ type, accent }: { type: "signup" | "payment" | "ticket"; accent: string }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    emerald: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
    amber: { bg: "bg-[var(--secondary)]/15", text: "text-[var(--secondary)]" },
    red: { bg: "bg-[var(--danger)]/15", text: "text-[var(--danger)]" },
    blue: { bg: "bg-[var(--accent)]/15", text: "text-[var(--accent)]" },
  };
  const c = colorMap[accent] ?? colorMap.blue;
  const Icon = type === "signup" ? UserPlus : type === "payment" ? CreditCard : Ticket;
  return (
    <div className={`size-8 rounded-xl ${c.bg} ${c.text} flex items-center justify-center shrink-0`}>
      <Icon className="size-4" />
    </div>
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
