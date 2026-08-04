import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { Search, Users } from "lucide-react";
import { AdminClientsTable } from "@/components/admin-clients-table";
import { AdminCreateClientButton } from "@/components/admin-create-client-button";
import { PageHero } from "@/components/page-hero";
import { isEmailConfigured } from "@/lib/email";
import { isWhatsappConfigured } from "@/lib/whatsapp";

export default async function ClientsListPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; plan?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, plan } = await searchParams;

  const users = await db.user.findMany({
    where: {
      AND: [
        { role: "USER" }, // exclut le staff interne (visible sur /admin/staff)
        { parentUserId: null }, // exclut les sous-comptes (visibles depuis fiche client)
        q
          ? {
              OR: [
                { email: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        plan ? { plan: { slug: plan } } : {},
      ],
    },
    include: { plan: { select: { name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const allPlans = await db.plan.findMany({ select: { slug: true, name: true }, orderBy: { sortOrder: "asc" } });

  return (
    <main className="p-4 sm:p-8 space-y-6">
      <PageHero
        icon={Users}
        variant="cyan"
        title="Clients"
        description={`${users.length} client(s) ${q || plan ? "(filtré)" : ""}`}
      />

      <div className="flex flex-wrap items-start gap-3">
        <form className="flex flex-wrap gap-3 flex-1 min-w-0">
          <div className="relative flex-1 min-w-60">
            <Search className="size-4 absolute start-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)]" />
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Email ou nom…"
              className="w-full rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] ps-10 pe-4 py-2 text-sm"
            />
          </div>
          <select
            name="plan"
            defaultValue={plan ?? ""}
            className="rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] px-3 py-2 text-sm"
          >
            <option value="">Tous les plans</option>
            {allPlans.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-ghost text-sm">Filtrer</button>
        </form>
        {/* Création directe d'un compte client depuis l'admin */}
        <AdminCreateClientButton allPlans={allPlans} />
      </div>

      <AdminClientsTable
        locale={locale}
        emailConfigured={isEmailConfigured()}
        whatsappConfigured={isWhatsappConfigured()}
        allPlans={allPlans.map((p) => ({ slug: p.slug, name: p.name }))}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          planSlug: u.plan?.slug ?? null,
          planName: u.plan?.name ?? null,
          storageUsed: u.storageUsed.toString(),
          storageQuota: u.storageQuota.toString(),
          createdAt: u.createdAt.toISOString(),
          suspendedAt: u.suspendedAt?.toISOString() ?? null,
          role: u.role,
        }))}
      />
    </main>
  );
}
