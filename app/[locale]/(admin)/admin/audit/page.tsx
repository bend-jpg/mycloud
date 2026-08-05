import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { Search, Filter, FileText, Download } from "lucide-react";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHero } from "@/components/page-hero";
import { Pagination, buildPageHref } from "@/components/pagination";

export default async function AdminAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; action?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await guardAdminPage("page.audit", locale);
  const { q, action, page } = await searchParams;

  const where: Record<string, unknown> = {};
  if (action) where.action = { contains: action };
  if (q) {
    where.OR = [
      { action: { contains: q, mode: "insensitive" } },
      { targetId: { contains: q } },
      { actor: { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } },
    ];
  }

  const PER_PAGE = 100;
  const currentPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);

  const [logs, totalCount, allActions] = await Promise.all([
    db.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { actor: { select: { email: true, name: true } } },
    }),
    db.adminAuditLog.count({ where }),
    // La liste des filtres doit couvrir TOUT le journal, pas seulement la
    // page affichée — sinon les options disponibles changeraient à chaque
    // changement de page.
    db.adminAuditLog.groupBy({ by: ["action"] }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

  // Filtres à transmettre à l'export (le numéro de page n'a pas de sens :
  // on exporte l'ensemble du résultat filtré, pas la page affichée).
  const exportQuery = new URLSearchParams(
    Object.entries({ q, action }).filter(([, v]) => Boolean(v)) as [string, string][],
  ).toString();
  const distinctActions = Array.from(
    new Set(allActions.map((a) => a.action.split(".")[0])),
  ).sort();

  return (
    <main className="p-4 sm:p-8 space-y-6">
      <PageHero
        icon={FileText}
        variant="red"
        title="Journal d'audit"
        description={
          totalCount === 0
            ? "Aucune action enregistrée"
            : `${totalCount} action(s) · page ${currentPage} sur ${totalPages}`
        }
        cta={
          totalCount > 0 ? (
            // L'export reprend les filtres actifs : ce qui est affiché est ce
            // qui est exporté. Un export ignorant les filtres produirait un
            // fichier ne correspondant pas à ce qu'on croit avoir demandé.
            <a
              href={`/api/admin/audit/export${exportQuery ? `?${exportQuery}` : ""}`}
              className="btn-primary text-sm"
              download
            >
              <Download className="size-4" />
              Exporter en CSV
            </a>
          ) : undefined
        }
      />

      <form className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-60">
          <Search className="size-4 absolute start-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)]" />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Action, acteur, ID cible…"
            className="w-full rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] ps-10 pe-4 py-2 text-sm"
          />
        </div>
        <select name="action" defaultValue={action ?? ""} className="rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] px-3 py-2 text-sm">
          <option value="">Toutes catégories</option>
          {distinctActions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <button type="submit" className="btn-primary text-sm"><Filter className="size-4" /> Filtrer</button>
      </form>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--background-elevated)] text-[var(--foreground-muted)] text-xs uppercase">
            <tr>
              <th className="text-start px-4 py-3">Date</th>
              <th className="text-start px-4 py-3">Acteur</th>
              <th className="text-start px-4 py-3">Action</th>
              <th className="text-start px-4 py-3">Cible</th>
              <th className="text-start px-4 py-3">Détails</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-[var(--background-elevated)]">
                <td className="px-4 py-3 text-xs whitespace-nowrap">{new Date(l.createdAt).toLocaleString(locale)}</td>
                <td className="px-4 py-3 text-xs">{l.actor.name ?? l.actor.email}</td>
                <td className="px-4 py-3"><code className="text-xs rounded bg-[var(--background-elevated)] px-2 py-0.5">{l.action}</code></td>
                <td className="px-4 py-3 text-xs">
                  {l.targetType} {l.targetId && <code className="opacity-60">{l.targetId.slice(0, 8)}</code>}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--foreground-muted)] max-w-md truncate">
                  {l.metadata ? JSON.stringify(l.metadata) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && (
          <p className="text-center text-sm text-[var(--foreground-muted)] py-12">Aucune action enregistrée.</p>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        label="Pagination du journal d'audit"
        buildHref={(p) => buildPageHref("/admin/audit", { q, action }, p)}
      />
    </main>
  );
}
