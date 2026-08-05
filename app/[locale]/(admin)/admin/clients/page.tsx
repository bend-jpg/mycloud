import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { Search, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AdminClientsTable } from "@/components/admin-clients-table";
import { AdminCreateClientButton } from "@/components/admin-create-client-button";
import { PageHero } from "@/components/page-hero";
import { isEmailConfigured } from "@/lib/email";
import { isWhatsappConfigured } from "@/lib/whatsapp";
import { guardAdminPage } from "@/lib/admin-guard";

export default async function ClientsListPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; plan?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Autorisation AVANT toute requête. Le garde du layout ne protège pas :
  // Next rend layout et page en parallèle, donc sans ce contrôle la page
  // interroge la base et ses données partent dans la réponse malgré la
  // redirection. Vérifié en production sur /admin/storage.
  await guardAdminPage("page.clients", locale);
  const { q, plan, page } = await searchParams;

  // Pagination : sans elle, `take: 100` rendait le 101ᵉ client purement
  // INVISIBLE dans l'interface — un bug fonctionnel, pas un simple souci
  // de performance.
  const PER_PAGE = 50;
  const currentPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);

  const where = {
    AND: [
      { role: "USER" as const }, // exclut le staff interne (visible sur /admin/staff)
      { parentUserId: null }, // exclut les sous-comptes (visibles depuis fiche client)
      q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" as const } },
              { name: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {},
      plan ? { plan: { slug: plan } } : {},
    ],
  };

  const [users, totalCount, allPlans] = await Promise.all([
    db.user.findMany({
      where,
      include: { plan: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    db.user.count({ where }),
    db.plan.findMany({ select: { slug: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));
  // Conserve les filtres actifs quand on change de page
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (plan) sp.set("plan", plan);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/admin/clients${qs ? `?${qs}` : ""}`;
  };

  return (
    <main className="p-4 sm:p-8 space-y-6">
      <PageHero
        icon={Users}
        variant="cyan"
        title="Clients"
        description={
          totalCount === 0
            ? "Aucun client"
            : `${totalCount} client(s)${q || plan ? " (filtré)" : ""} · page ${currentPage} sur ${totalPages}`
        }
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

      {totalPages > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label="Pagination des clients">
          <Link
            href={pageHref(currentPage - 1)}
            aria-disabled={currentPage === 1}
            className={`btn-ghost text-sm ${currentPage === 1 ? "pointer-events-none opacity-40" : ""}`}
          >
            <ChevronLeft className="size-4 rtl:rotate-180" />
            Précédent
          </Link>

          <span className="text-sm text-[var(--foreground-muted)]">
            Page {currentPage} sur {totalPages}
          </span>

          <Link
            href={pageHref(currentPage + 1)}
            aria-disabled={currentPage >= totalPages}
            className={`btn-ghost text-sm ${currentPage >= totalPages ? "pointer-events-none opacity-40" : ""}`}
          >
            Suivant
            <ChevronRight className="size-4 rtl:rotate-180" />
          </Link>
        </nav>
      )}
    </main>
  );
}
