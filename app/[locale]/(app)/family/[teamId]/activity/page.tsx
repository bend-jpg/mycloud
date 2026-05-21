import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getMembership } from "@/lib/teams";
import { SiteHeader } from "@/components/site-header";
import { TeamActivityList } from "@/components/team-activity-list";
import { ChevronLeft, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TeamActivityPage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string }>;
}) {
  const { locale, teamId } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  // Vérifie que l'utilisateur est bien membre du team
  const m = await getMembership(teamId, session.id);
  if (!m) notFound();

  const items = await db.activityLog.findMany({
    where: { teamId, action: { startsWith: "team." } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { name: true, email: true, image: true } } },
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 space-y-6">
        <Link
          href={`/family/${teamId}`}
          className="inline-flex items-center gap-1 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
          Retour à l&apos;espace
        </Link>

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Activity className="size-7 text-[var(--accent)]" />
            Activité de la famille
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">
            Toutes les actions effectuées par les membres de <strong>{m.team.name}</strong> :
            uploads, suppressions, invitations. Les 100 dernières sont conservées.
          </p>
        </div>

        <TeamActivityList
          items={items.map((a) => ({
            id: a.id,
            action: a.action,
            user: {
              name: a.user.name,
              email: a.user.email,
              image: a.user.image,
            },
            metadata: a.metadata as Record<string, unknown> | null,
            createdAt: a.createdAt.toISOString(),
          }))}
        />
      </main>
    </>
  );
}
