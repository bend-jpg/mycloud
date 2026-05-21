import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { TeamsList } from "@/components/teams-list";
import { BackLink } from "@/components/back-link";
import { PageHero } from "@/components/page-hero";
import { Users } from "lucide-react";

export default async function FamilyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const memberships = await db.membership.findMany({
    where: { userId: session.id },
    include: {
      team: { include: { _count: { select: { members: true, files: true } } } },
    },
    orderBy: { joinedAt: "desc" },
  });

  const user = await db.user.findUnique({
    where: { id: session.id },
    include: { plan: true },
  });
  const canCreate = (user?.plan?.maxMembers ?? 1) >= 2;
  const planName = user?.plan?.name ?? "Starter";

  const teams = memberships.map((m) => ({
    id: m.team.id,
    name: m.team.name,
    type: m.team.type,
    role: m.role,
    memberCount: m.team._count.members,
    fileCount: m.team._count.files,
  }));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
        <BackLink />
        <PageHero
          icon={Users}
          variant="amber"
          title="Espaces partagés"
          description={
            <>
              Crée un espace pour partager des fichiers avec ta famille ou ton équipe.{" "}
              {teams.length} espace(s) actuellement.
            </>
          }
        />

        <TeamsList teams={teams} canCreate={canCreate} planName={planName} />
      </main>
    </>
  );
}
