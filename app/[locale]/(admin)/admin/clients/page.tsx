import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { Search } from "lucide-react";
import { AdminClientRow } from "@/components/admin-client-row";

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
    <main className="p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Clients</h1>
          <p className="text-[var(--foreground-muted)] mt-1">{users.length} résultat{users.length > 1 ? "s" : ""}</p>
        </div>
      </div>

      <form className="flex flex-wrap gap-3">
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
        <button type="submit" className="btn-primary text-sm">Filtrer</button>
      </form>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--background-elevated)] text-[var(--foreground-muted)] text-xs uppercase">
            <tr>
              <th className="text-start px-4 py-3">Client</th>
              <th className="text-start px-4 py-3">Plan</th>
              <th className="text-end px-4 py-3">Stockage</th>
              <th className="text-start px-4 py-3">Inscrit le</th>
              <th className="text-start px-4 py-3">Statut</th>
              <th className="w-10 px-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {users.map((u) => (
              <AdminClientRow
                key={u.id}
                locale={locale}
                allPlans={allPlans.map((p) => ({ slug: p.slug, name: p.name }))}
                user={{
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
                }}
              />
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="text-center text-sm text-[var(--foreground-muted)] py-12">Aucun client trouvé.</div>
        )}
      </div>
    </main>
  );
}
