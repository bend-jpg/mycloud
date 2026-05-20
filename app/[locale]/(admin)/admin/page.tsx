import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/utils";
import { Users, HardDrive, CreditCard, Ticket, FolderTree, Link as LinkIcon } from "lucide-react";

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

  return (
    <main className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Vue d&apos;ensemble</h1>
        <p className="text-[var(--foreground-muted)] mt-1">État du SaaS en temps réel.</p>
      </div>

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
