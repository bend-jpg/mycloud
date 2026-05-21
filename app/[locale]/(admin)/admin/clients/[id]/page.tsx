import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatBytes, formatPrice } from "@/lib/utils";
import { userCostAndMargin } from "@/lib/cost-stats";
import { marginColor } from "@/lib/pricing";
import { ChevronLeft, Mail, Phone, MessageCircle, Calendar, TrendingUp, Wallet, FolderOpen } from "lucide-react";
import { AdminClientEditPanel } from "@/components/admin-client-edit-panel";
import { RecordPaymentButton } from "@/components/admin-record-payment-button";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await db.user.findUnique({
    where: { id },
    include: {
      plan: true,
      subscription: { include: { plan: true } },
      memberships: {
        include: { team: { include: { _count: { select: { members: true, files: true } } } } },
      },
      payments: { orderBy: { createdAt: "desc" }, take: 20 },
      ticketsOpened: { orderBy: { updatedAt: "desc" }, take: 10 },
      subAccounts: { select: { id: true, name: true, email: true, storageQuota: true, storageUsed: true } },
    },
  });
  if (!user) notFound();

  // Si c'est un staff interne, rediriger vers la fiche staff dédiée
  if (user.role !== "USER") {
    redirect(`/${locale}/admin/staff/${user.id}`);
  }

  const allPlans = await db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });

  const filesCount = await db.file.count({ where: { ownerId: user.id, isTrash: false } });
  const used = Number(user.storageUsed);
  const quota = Number(user.storageQuota);
  const pct = quota > 0 ? Math.round((used / quota) * 100) : 0;
  const cost = await userCostAndMargin(user.id);
  const mColor = cost ? marginColor(cost.marginEur, cost.revenueMonthlyCents) : "ok";

  return (
    <main className="p-4 sm:p-8 space-y-6">
      <Link
        href="/admin/clients"
        className="flex items-center gap-1 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
      >
        <ChevronLeft className="size-4 rtl:rotate-180" />
        Tous les clients
      </Link>

      {/* Header profil */}
      <div className="tile cursor-default !min-h-0">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="size-16 rounded-2xl bg-[var(--background-elevated)] flex items-center justify-center text-2xl font-semibold">
            {(user.name ?? user.email).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
              {user.name ?? "—"}
              {user.suspendedAt && (
                <span className="text-xs rounded-full bg-[var(--danger)]/10 text-[var(--danger)] px-2 py-0.5">
                  Suspendu
                </span>
              )}
            </h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-[var(--foreground-muted)]">
              <span className="flex items-center gap-1.5"><Mail className="size-3.5" /> {user.email}</span>
              {user.phone && <span className="flex items-center gap-1.5"><Phone className="size-3.5" /> {user.phone}</span>}
              {user.whatsapp && (
                <a
                  href={`https://wa.me/${user.whatsapp.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-emerald-400 hover:underline"
                >
                  <MessageCircle className="size-3.5" /> WhatsApp
                </a>
              )}
              <span className="flex items-center gap-1.5"><Calendar className="size-3.5" /> Inscrit le {new Date(user.createdAt).toLocaleDateString(locale)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="rounded-xl bg-[var(--background-elevated)] p-3">
            <p className="text-xs text-[var(--foreground-muted)]">Plan</p>
            <p className="text-lg font-bold">{user.plan?.name ?? "—"}</p>
          </div>
          <div className="rounded-xl bg-[var(--background-elevated)] p-3">
            <p className="text-xs text-[var(--foreground-muted)]">Stockage</p>
            <p className="text-lg font-bold">{formatBytes(used)} / {formatBytes(quota)}</p>
            <div className="h-1 mt-1 rounded-full bg-[var(--background-tile)] overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--secondary)]" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </div>
          <div className="rounded-xl bg-[var(--background-elevated)] p-3">
            <p className="text-xs text-[var(--foreground-muted)]">Fichiers · Sous-comptes</p>
            <p className="text-lg font-bold">{filesCount} · {user.subAccounts.length}</p>
          </div>
          <div className="rounded-xl bg-[var(--background-elevated)] p-3">
            <p className="text-xs text-[var(--foreground-muted)]">Renouvellement</p>
            <p className="text-sm font-bold">
              {user.subscription?.currentPeriodEnd
                ? new Date(user.subscription.currentPeriodEnd).toLocaleDateString(locale)
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Panneau édition (tabs) */}
      <AdminClientEditPanel
        userId={user.id}
        initial={{
          name: user.name ?? "",
          email: user.email,
          phone: user.phone ?? "",
          whatsapp: user.whatsapp ?? "",
          locale: user.locale,
          planSlug: user.plan?.slug ?? null,
          storageQuotaBytes: user.storageQuota.toString(),
          isSuspended: !!user.suspendedAt,
          subscription: user.subscription
            ? {
                currentPeriodEnd: user.subscription.currentPeriodEnd.toISOString(),
                status: user.subscription.status,
                cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
              }
            : null,
        }}
        allPlans={allPlans.map((p) => ({
          slug: p.slug,
          name: p.name,
          storageBytes: p.storageBytes.toString(),
        }))}
      />

      {/* Rentabilité */}
      {cost && (
        <div className="tile cursor-default !min-h-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="tile-icon">
              <Wallet className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold">Rentabilité estimée</h2>
              <p className="text-xs text-[var(--foreground-muted)]">
                Calcul mensuel basé sur les prix R2/B2/S3 publics et la subscription.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-[var(--background-elevated)] p-3">
              <p className="text-xs text-[var(--foreground-muted)]">Revenu / mois</p>
              <p className="text-lg font-bold text-[var(--success)]">
                {(cost.revenueMonthlyCents / 100).toFixed(2)} €
              </p>
            </div>
            <div className="rounded-xl bg-[var(--background-elevated)] p-3">
              <p className="text-xs text-[var(--foreground-muted)]">Coût hébergement</p>
              <p className="text-lg font-bold text-[var(--danger)]">
                {cost.storageCostEur.toFixed(2)} €
              </p>
            </div>
            <div className="rounded-xl bg-[var(--background-elevated)] p-3">
              <p className="text-xs text-[var(--foreground-muted)]">Marge</p>
              <p
                className={`text-lg font-bold ${
                  mColor === "good"
                    ? "text-[var(--success)]"
                    : mColor === "ok"
                    ? "text-yellow-400"
                    : "text-[var(--danger)]"
                }`}
              >
                {cost.marginEur.toFixed(2)} €
              </p>
              <p className="text-xs text-[var(--foreground-muted)]">
                {cost.revenueMonthlyCents > 0
                  ? `${Math.round((cost.marginEur / (cost.revenueMonthlyCents / 100)) * 100)}%`
                  : ""}
              </p>
            </div>
          </div>
          {cost.perBackend.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-[var(--foreground-muted)]">
              {cost.perBackend.map((b) => (
                <li key={b.backendId} className="flex justify-between">
                  <span>
                    <TrendingUp className="size-3 inline me-1" />
                    {b.backendName} ({b.type})
                  </span>
                  <span>
                    {formatBytes(b.bytes)} · {b.costEur.toFixed(2)} €/mois
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Paiements */}
      <div className="tile cursor-default !min-h-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Paiements ({user.payments.length})</h2>
          <RecordPaymentButton userId={user.id} />
        </div>
        {user.payments.length === 0 ? (
          <p className="text-sm text-[var(--foreground-muted)]">Aucun paiement enregistré.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {user.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{formatPrice(p.amount, p.currency as "EUR" | "USD")}</p>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    {p.method} · {new Date(p.createdAt).toLocaleDateString(locale)}
                    {p.notes && ` · ${p.notes}`}
                  </p>
                </div>
                <span
                  className={`text-xs rounded-full px-2 py-1 ${
                    p.status === "SUCCEEDED"
                      ? "text-[var(--success)] bg-[var(--success)]/10"
                      : p.status === "PENDING"
                      ? "text-yellow-400 bg-yellow-400/10"
                      : "text-[var(--danger)] bg-[var(--danger)]/10"
                  }`}
                >
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Espaces partagés + sous-comptes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {user.memberships.length > 0 && (
          <div className="tile cursor-default !min-h-0">
            <h2 className="font-semibold mb-4">Espaces partagés ({user.memberships.length})</h2>
            <ul className="space-y-2">
              {user.memberships.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm py-2">
                  <div>
                    <p className="font-medium">{m.team.name}</p>
                    <p className="text-xs text-[var(--foreground-muted)]">
                      {m.team.type} · {m.team._count.members} membres · {m.team._count.files} fichiers
                    </p>
                  </div>
                  <span className="text-xs rounded-full border border-[var(--border)] px-2 py-1">{m.role}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {user.subAccounts.length > 0 && (
          <div className="tile cursor-default !min-h-0">
            <h2 className="font-semibold mb-4">Sous-comptes ({user.subAccounts.length})</h2>
            <ul className="space-y-2">
              {user.subAccounts.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm py-2">
                  <div>
                    <p className="font-medium">{s.name ?? s.email}</p>
                    <p className="text-xs text-[var(--foreground-muted)]">{s.email}</p>
                  </div>
                  <span className="text-xs text-[var(--foreground-muted)]">
                    {formatBytes(Number(s.storageUsed))} / {formatBytes(Number(s.storageQuota))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Link
        href={`/admin/clients/${id}/files`}
        className="tile cursor-pointer hover:scale-[1.01] !min-h-0 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="tile-icon">
            <FolderOpen className="size-5" />
          </div>
          <div>
            <p className="font-semibold">Voir les fichiers du client</p>
            <p className="text-xs text-[var(--foreground-muted)]">
              Navigation lecture seule dans son cloud (preview, download).
            </p>
          </div>
        </div>
        <ChevronLeft className="size-4 rotate-180 rtl:rotate-0 text-[var(--foreground-muted)]" />
      </Link>
    </main>
  );
}
