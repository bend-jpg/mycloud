import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { BillingPlans } from "@/components/billing-plans";
import { ManageSubscriptionButton } from "@/components/manage-subscription-button";
import { BackLink } from "@/components/back-link";
import { PageHero } from "@/components/page-hero";
import { formatBytes, formatPrice } from "@/lib/utils";
import { CreditCard, Bitcoin, Receipt, Crown } from "lucide-react";

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ canceled?: string; session_id?: string; crypto?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { canceled, session_id, crypto } = await searchParams;

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const [user, plans, payments] = await Promise.all([
    db.user.findUnique({
      where: { id: session.id },
      include: { plan: true, subscription: { include: { plan: true } } },
    }),
    db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.payment.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  if (!user) redirect(`/${locale}/login`);

  const hasSubscription = !!user.subscription?.stripeSubId;
  const currentPlanSlug = user.plan?.slug ?? null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
        <BackLink />
        <PageHero
          icon={Crown}
          variant="amber"
          title="Mon plan"
          description={
            <>
              Plan actuel : <strong className="text-[var(--foreground)]">{user.plan?.name ?? "—"}</strong>
              {user.subscription?.currentPeriodEnd && (
                <> · Renouvellement le {new Date(user.subscription.currentPeriodEnd).toLocaleDateString(locale)}</>
              )}
            </>
          }
        />

        {session_id && (
          <div className="rounded-2xl bg-[var(--success)]/10 border border-[var(--success)]/30 p-4 text-sm">
            ✅ Paiement confirmé ! Ton plan est activé. (Si tu ne vois pas le changement, rafraîchis dans quelques secondes.)
          </div>
        )}
        {canceled && (
          <div className="rounded-2xl bg-yellow-400/10 border border-yellow-400/30 p-4 text-sm">
            Paiement annulé. Tu peux réessayer à tout moment.
          </div>
        )}
        {crypto === "success" && (
          <div className="rounded-2xl bg-[var(--success)]/10 border border-[var(--success)]/30 p-4 text-sm">
            ⏳ Paiement crypto en attente de confirmation sur la blockchain. Ton plan sera activé sous 10-30 minutes.
          </div>
        )}

        {/* Plan actuel */}
        <div className="tile cursor-default !min-h-0">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="tile-icon">
                <Crown className="size-6" />
              </div>
              <div>
                <p className="text-sm text-[var(--foreground-muted)]">Plan actuel</p>
                <p className="text-2xl font-bold">{user.plan?.name ?? "Aucun"}</p>
                <p className="text-sm text-[var(--foreground-muted)]">
                  {formatBytes(user.storageQuota)} de stockage
                </p>
              </div>
            </div>
            {hasSubscription && (
              <div className="text-end">
                <p className="text-xs text-[var(--foreground-muted)]">Renouvellement</p>
                <p className="text-sm">
                  {user.subscription?.currentPeriodEnd
                    ? new Date(user.subscription.currentPeriodEnd).toLocaleDateString(locale)
                    : "—"}
                </p>
                {user.subscription?.cancelAtPeriodEnd && (
                  <p className="text-xs text-yellow-400 mt-1">Annulation à échéance</p>
                )}
                <ManageSubscriptionButton />
              </div>
            )}
          </div>
        </div>

        {/* Plans disponibles */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Changer de plan</h2>
          <BillingPlans
            plans={plans.map((p) => ({
              slug: p.slug,
              name: p.name,
              storageBytes: p.storageBytes.toString(),
              maxMembers: p.maxMembers,
              websiteHosting: p.websiteHosting,
              claudeCodeHosting: p.claudeCodeHosting,
              priceMonthlyEur: p.priceMonthlyEur,
              priceYearlyEur: p.priceYearlyEur,
              priceMonthlyUsd: p.priceMonthlyUsd,
              priceYearlyUsd: p.priceYearlyUsd,
              highlighted: p.highlighted,
              hasStripeIds: !!p.stripePriceMonthlyEurId,
            }))}
            currentPlanSlug={currentPlanSlug}
          />
        </div>

        {/* Historique paiements */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Receipt className="size-5" />
            Historique des paiements
          </h2>
          {payments.length === 0 ? (
            <div className="tile cursor-default !min-h-0 text-center text-sm text-[var(--foreground-muted)]">
              Aucun paiement pour l&apos;instant.
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--background-elevated)] text-[var(--foreground-muted)] text-xs uppercase">
                  <tr>
                    <th className="text-start px-4 py-3">Date</th>
                    <th className="text-end px-4 py-3">Montant</th>
                    <th className="text-start px-4 py-3">Méthode</th>
                    <th className="text-start px-4 py-3">Statut</th>
                    <th className="text-end px-4 py-3">Facture</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 text-xs">{new Date(p.createdAt).toLocaleDateString(locale)}</td>
                      <td className="px-4 py-3 text-end font-semibold">
                        {formatPrice(p.amount, p.currency as "EUR" | "USD")}
                      </td>
                      <td className="px-4 py-3 text-xs flex items-center gap-1">
                        {p.method === "CRYPTO" ? <Bitcoin className="size-3.5" /> : <CreditCard className="size-3.5" />}
                        {p.method}
                      </td>
                      <td className="px-4 py-3">
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
                      </td>
                      <td className="px-4 py-3 text-end">
                        {p.invoiceUrl ? (
                          <a
                            href={p.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[var(--accent)] hover:underline"
                          >
                            {p.invoiceNumber ?? "Voir"}
                          </a>
                        ) : (
                          <span className="text-xs text-[var(--foreground-muted)]">{p.invoiceNumber ?? "—"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
