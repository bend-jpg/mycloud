// Admin : voir qui s'est pré-inscrit à l'hébergement Phase 9.

export const dynamic = "force-dynamic";

import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { Globe, Bot } from "lucide-react";

export default async function AdminHostingWaitlistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await guardAdminPage("page.overview", locale); // accessible à tous les staff

  const entries = await db.hostingWaitlistEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const sites = entries.filter((e) => e.kind === "site");
  const claudes = entries.filter((e) => e.kind === "claude-code");

  return (
    <main className="p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Hébergement — liste d&apos;attente</h1>
        <p className="text-sm text-[var(--foreground-muted)] mt-1">
          Pré-inscriptions Phase 9 (hébergement de sites et Claude Code). Sert à prioriser et à
          contacter les early adopters quand on est prêt.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WaitlistTable
          title="Hébergement de sites"
          icon={Globe}
          color="emerald-400"
          entries={sites}
          locale={locale}
        />
        <WaitlistTable
          title="Claude Code"
          icon={Bot}
          color="violet-400"
          entries={claudes}
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
          {entries.length}
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
    </div>
  );
}
