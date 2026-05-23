import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { AdminPlansManager } from "@/components/admin-plan-editor";
import { AdminSyncStripeButton } from "@/components/admin-sync-stripe-button";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHero } from "@/components/page-hero";
import { Tag } from "lucide-react";

export default async function AdminPlansPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await guardAdminPage("page.plans", locale);
  const plans = await db.plan.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <main className="p-4 sm:p-8 space-y-6">
      <PageHero
        icon={Tag}
        variant="amber"
        title="Plans tarifaires"
        description={`${plans.length} plan(s) — crée, modifie et désactive ceux visibles par tes clients.`}
        cta={<AdminSyncStripeButton />}
      />

      <AdminPlansManager
        plans={plans.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          descriptionFr: p.descriptionFr,
          descriptionEn: p.descriptionEn,
          descriptionEs: p.descriptionEs,
          descriptionHe: p.descriptionHe,
          storageBytes: p.storageBytes.toString(),
          maxMembers: p.maxMembers,
          maxShareLinks: p.maxShareLinks,
          maxShareDays: p.maxShareDays,
          websiteHosting: p.websiteHosting,
          claudeCodeHosting: p.claudeCodeHosting,
          priceMonthlyEur: p.priceMonthlyEur,
          priceYearlyEur: p.priceYearlyEur,
          priceMonthlyUsd: p.priceMonthlyUsd,
          priceYearlyUsd: p.priceYearlyUsd,
          active: p.active,
          highlighted: p.highlighted,
          sortOrder: p.sortOrder,
          userCount: p._count.users,
        }))}
      />

      <p className="text-xs text-[var(--foreground-muted)]">
        💡 Après modification, n&apos;oublie pas de cliquer sur « Synchroniser vers Stripe » en haut pour
        propager les prix à Stripe (sinon Stripe garde l&apos;ancien tarif).
      </p>
    </main>
  );
}
