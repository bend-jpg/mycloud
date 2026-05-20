import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatBytes, formatPrice } from "@/lib/utils";
import { userCostAndMargin } from "@/lib/cost-stats";
import { marginColor } from "@/lib/pricing";
import { ChevronLeft, Mail, Phone, MessageCircle, Calendar, TrendingUp, Wallet } from "lucide-react";
import { ClientActions } from "@/components/admin-client-actions";
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
    },
  });
  if (!user) notFound();

  const allPlans = await db.plan.findMany({ orderBy: { sortOrder: "asc" } });

  const filesCount = await db.file.count({ where: { ownerId: user.id, isTrash: false } });
  const used = Number(user.storageUsed);
  const quota = Number(user.storageQuota);
  const pct = quota > 0 ? Math.round((used / quota) * 100) : 0;
  const cost = await userCostAndMargin(user.id);
  const mColor = cost ? marginColor(cost.marginEur, cost.revenueMonthlyCents) : "ok";

  return (
    <main className="p-8 space-y-6">
      <Link
        href="/admin/clients"
        className="flex items-center gap-1 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
      >
        <ChevronLeft className="size-4 rtl:rotate-180" />
        Tous les clients
      </Link>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Carte profil */}
        <div className="md:w-72 space-y-4">
          <div className="tile cursor-default !min-h-0">
            <div className="size-16 rounded-2xl bg-[var(--background-elevated)] flex items-center justify-center text-2xl font-semibold mb-3">
              {(user.name ?? user.email).charAt(0).toUpperCase()}
            </div>
            <h1 className="text-xl font-bold">{user.name ?? "—"}</h1>
            <div className="space-y-1.5 mt-2 text-sm text-[var(--foreground-muted)]">
              <p className="flex items-center gap-2">
                <Mail className="size-3.5" /> {user.email}
              </p>
              {user.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="size-3.5" /> {user.phone}
                </p>
              )}
              {user.whatsapp && (
                <a
                  href={`https://wa.me/${user.whatsapp.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-emerald-400 hover:underline"
                >
                  <MessageCircle className="size-3.5" /> WhatsApp
                </a>
              )}
              <p className="flex items-center gap-2">
                <Calendar className="size-3.5" /> Inscrit le {new Date(user.createdAt).toLocaleDateString(locale)}
              </p>
            </div>
            {user.suspendedAt && (
              <p className="mt-3 text-xs rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] px-3 py-2">
                Compte suspendu le {new Date(user.suspendedAt).toLocaleDateString(locale)}
              </p>
            )}
          </div>

          <ClientActions
            userId={user.id}
            currentPlanSlug={user.plan?.slug ?? null}
            isSuspended={!!user.suspendedAt}
            currentQuota={quota}
            allPlans={allPlans.map((p) => ({
              slug: p.slug,
              name: p.name,
              storageBytes: p.storageBytes.toString(),
            }))}
          />
        </div>

        {/* Contenu */}
        <div className="flex-1 space-y-6">
          {/* Plan & usage */}
          <div className="tile cursor-default !min-h-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[var(--foreground-muted)]">Plan actuel</p>
                <p className="text-2xl font-bold">{user.plan?.name ?? "Aucun"}</p>
              </div>
              <div className="text-end">
                <p className="text-sm text-[var(--foreground-muted)]">Stockage utilisé</p>
                <p className="text-lg font-semibold">
                  {formatBytes(used)} / {formatBytes(quota)} ({pct}%)
                </p>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-[var(--background-elevated)] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--secondary)]"
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4 text-center">
              <div className="rounded-xl bg-[var(--background-elevated)] p-3">
                <p className="text-xs text-[var(--foreground-muted)]">Fichiers</p>
                <p className="text-lg font-semibold">{filesCount}</p>
              </div>
              <div className="rounded-xl bg-[var(--background-elevated)] p-3">
                <p className="text-xs text-[var(--foreground-muted)]">Espaces</p>
                <p className="text-lg font-semibold">{user.memberships.length}</p>
              </div>
              <div className="rounded-xl bg-[var(--background-elevated)] p-3">
                <p className="text-xs text-[var(--foreground-muted)]">Tickets</p>
                <p className="text-lg font-semibold">{user.ticketsOpened.length}</p>
              </div>
            </div>
          </div>

          {/* Rentabilité de ce client */}
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

          {/* Espaces partagés */}
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
        </div>
      </div>
    </main>
  );
}
