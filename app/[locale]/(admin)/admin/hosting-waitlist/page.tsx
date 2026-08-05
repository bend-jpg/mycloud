// Admin : voir qui s'est pré-inscrit à l'hébergement Phase 9.

export const dynamic = "force-dynamic";

import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { Globe, Bot, Rocket } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Pagination } from "@/components/pagination";

/**
 * Inscriptions par page et par table.
 *
 * La liste était plafonnée à 500 sans pagination, et les deux tables
 * étaient obtenues en filtrant ce lot en mémoire. Au-delà du seuil les
 * inscriptions devenaient invisibles — et pire, le déséquilibre entre les
 * deux catégories pouvait faire disparaître entièrement la plus récente
 * des deux. Chaque table est maintenant comptée et paginée séparément.
 */
const PAGE_SIZE = 100;

const SELECT_USER = { user: { select: { id: true, name: true, email: true } } };

export default async function AdminHostingWaitlistPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sp?: string; cp?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await guardAdminPage("page.overview", locale); // accessible à tous les staff

  const { sp, cp } = await searchParams;
  const askedSites = Math.max(1, Number.parseInt(sp ?? "1", 10) || 1);
  const askedClaude = Math.max(1, Number.parseInt(cp ?? "1", 10) || 1);

  const [sitesTotal, claudesTotal] = await Promise.all([
    db.hostingWaitlistEntry.count({ where: { kind: "site" } }),
    db.hostingWaitlistEntry.count({ where: { kind: "claude-code" } }),
  ]);

  const sitesPages = Math.max(1, Math.ceil(sitesTotal / PAGE_SIZE));
  const claudesPages = Math.max(1, Math.ceil(claudesTotal / PAGE_SIZE));
  const sitesPage = Math.min(askedSites, sitesPages);
  const claudesPage = Math.min(askedClaude, claudesPages);

  const [sites, claudes] = await Promise.all([
    db.hostingWaitlistEntry.findMany({
      where: { kind: "site" },
      orderBy: { createdAt: "desc" },
      skip: (sitesPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: SELECT_USER,
    }),
    db.hostingWaitlistEntry.findMany({
      where: { kind: "claude-code" },
      orderBy: { createdAt: "desc" },
      skip: (claudesPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: SELECT_USER,
    }),
  ]);

  const entriesTotal = sitesTotal + claudesTotal;

  // Chaque table a son propre paramètre de page (sp / cp) : naviguer dans
  // l'une ne doit pas réinitialiser l'autre.
  const hrefFor = (which: "sp" | "cp", page: number) => {
    const query = new URLSearchParams();
    const other = which === "sp" ? cp : sp;
    if (other && other !== "1") query.set(which === "sp" ? "cp" : "sp", other);
    if (page > 1) query.set(which, String(page));
    const qs = query.toString();
    return `/admin/hosting-waitlist${qs ? `?${qs}` : ""}`;
  };

  return (
    <main className="p-4 sm:p-8 space-y-6">
      <PageHero
        icon={Rocket}
        variant="green"
        title="Hébergement — liste d'attente"
        description={
          <>
            {entriesTotal} inscription(s) — Sites : {sitesTotal} · Claude Code : {claudesTotal}. Sert à
            prioriser et contacter les early adopters quand on lance Phase 9.
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WaitlistTable
          title="Hébergement de sites"
          icon={Globe}
          color="emerald-400"
          entries={sites}
          total={sitesTotal}
          currentPage={sitesPage}
          totalPages={sitesPages}
          buildHref={(p) => hrefFor("sp", p)}
          locale={locale}
        />
        <WaitlistTable
          title="Claude Code"
          icon={Bot}
          color="violet-400"
          entries={claudes}
          total={claudesTotal}
          currentPage={claudesPage}
          totalPages={claudesPages}
          buildHref={(p) => hrefFor("cp", p)}
          locale={locale}
        />
      </div>
    </main>
  );
}

function WaitlistTable({
  title,
  icon: Icon,
  color,
  entries,
  total,
  currentPage,
  totalPages,
  buildHref,
  locale,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  entries: Array<{
    id: string;
    notes: string | null;
    createdAt: Date;
    user: { id: string; name: string | null; email: string };
  }>;
  /** Total réel en base — le badge affichait le nombre de la page en cours. */
  total: number;
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
  locale: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <h2 className="font-semibold flex items-center gap-2">
          <Icon className={`size-5 text-${color}`} />
          {title}
        </h2>
        <span className="text-sm rounded-full bg-[var(--background-elevated)] px-2 py-0.5">
          {total}
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="p-6 text-center text-sm text-[var(--foreground-muted)]">
          Personne pour l&apos;instant.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)] max-h-96 overflow-y-auto">
          {entries.map((e) => (
            <li key={e.id} className="p-3 text-sm">
              <Link
                href={`/admin/clients/${e.user.id}`}
                className="font-medium hover:text-[var(--accent)]"
              >
                {e.user.name ?? e.user.email}
              </Link>
              <p className="text-xs text-[var(--foreground-muted)]">{e.user.email}</p>
              {e.notes && (
                <p className="text-xs italic text-[var(--foreground-muted)] mt-1">
                  « {e.notes} »
                </p>
              )}
              <p className="text-[10px] text-[var(--foreground-muted)] mt-1">
                {new Date(e.createdAt).toLocaleString(locale)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 && (
        <div className="p-3 border-t border-[var(--border)]">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            buildHref={buildHref}
            label={`Pagination — ${title}`}
          />
        </div>
      )}
    </div>
  );
}
