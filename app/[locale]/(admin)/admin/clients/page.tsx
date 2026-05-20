import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/utils";
import { Search, AlertCircle } from "lucide-react";

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

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--background-elevated)] text-[var(--foreground-muted)] text-xs uppercase">
            <tr>
              <th className="text-start px-4 py-3">Client</th>
              <th className="text-start px-4 py-3">Plan</th>
              <th className="text-end px-4 py-3">Stockage</th>
              <th className="text-start px-4 py-3">Inscrit le</th>
              <th className="text-start px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {users.map((u) => {
              const used = Number(u.storageUsed);
              const quota = Number(u.storageQuota);
              const pct = quota > 0 ? Math.round((used / quota) * 100) : 0;
              return (
                <tr key={u.id} className="hover:bg-[var(--background-elevated)] transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/clients/${u.id}`} className="flex items-center gap-3 hover:text-[var(--accent)]">
                      <div className="size-9 rounded-full bg-[var(--background-elevated)] flex items-center justify-center text-xs font-semibold">
                        {(u.name ?? u.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{u.name ?? "—"}</p>
                        <p className="text-xs text-[var(--foreground-muted)]">{u.email}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs rounded-full border border-[var(--border)] px-2 py-1">
                      {u.plan?.name ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <p className="text-xs text-[var(--foreground-muted)]">
                      {formatBytes(used)} / {formatBytes(quota)}
                    </p>
                    <div className="h-1 mt-1 rounded-full bg-[var(--background-elevated)] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--secondary)]"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--foreground-muted)]">
                    {new Date(u.createdAt).toLocaleDateString(locale)}
                  </td>
                  <td className="px-4 py-3">
                    {u.suspendedAt ? (
                      <span className="text-xs text-[var(--danger)] flex items-center gap-1">
                        <AlertCircle className="size-3" /> Suspendu
                      </span>
                    ) : u.role !== "USER" ? (
                      <span className="text-xs text-[var(--accent)]">{u.role}</span>
                    ) : (
                      <span className="text-xs text-[var(--success)]">Actif</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="text-center text-sm text-[var(--foreground-muted)] py-12">Aucun client trouvé.</div>
        )}
      </div>
    </main>
  );
}
