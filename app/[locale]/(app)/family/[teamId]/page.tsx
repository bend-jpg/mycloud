import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getMembership } from "@/lib/teams";
import { SiteHeader } from "@/components/site-header";
import { TeamMembers } from "@/components/team-members";
import { TeamInvites } from "@/components/team-invites";
import { InviteMemberButton } from "@/components/invite-member-button";
import { FolderOpen, Users, Briefcase, Activity } from "lucide-react";

export default async function TeamHomePage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string }>;
}) {
  const { locale, teamId } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const m = await getMembership(teamId, session.id);
  if (!m) notFound();

  const [members, invites, fileCount, folderCount] = await Promise.all([
    db.membership.findMany({
      where: { teamId },
      include: { user: { select: { id: true, email: true, name: true, image: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    db.invite.findMany({
      where: { teamId, acceptedAt: null },
      orderBy: { createdAt: "desc" },
    }),
    db.file.count({ where: { teamId, isTrash: false } }),
    db.folder.count({ where: { teamId, isTrash: false } }),
  ]);

  const canManage = m.role === "OWNER" || m.role === "ADMIN";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="tile-icon !size-14">
              {m.team.type === "FAMILY" ? <Users className="size-7" /> : <Briefcase className="size-7" />}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{m.team.name}</h1>
              <p className="text-sm text-[var(--foreground-muted)]">
                Ton rôle : <span className="text-[var(--accent)]">{m.role}</span>
              </p>
            </div>
          </div>
          {canManage && <InviteMemberButton teamId={teamId} />}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href={`/family/${teamId}/files`} className="tile group">
            <div className="tile-icon">
              <FolderOpen className="size-6" />
            </div>
            <div className="mt-auto flex items-end justify-between">
              <div>
                <h2 className="text-xl font-semibold">Fichiers partagés</h2>
                <p className="text-sm text-[var(--foreground-muted)] mt-1">
                  {fileCount} fichier{fileCount > 1 ? "s" : ""} · {folderCount} dossier
                  {folderCount > 1 ? "s" : ""}
                </p>
              </div>
              <span className="text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </div>
          </Link>
          <Link href={`/family/${teamId}/activity`} className="tile group">
            <div className="tile-icon text-violet-400">
              <Activity className="size-6" />
            </div>
            <div className="mt-auto flex items-end justify-between">
              <div>
                <h2 className="text-xl font-semibold">Activité</h2>
                <p className="text-sm text-[var(--foreground-muted)] mt-1">
                  Qui upload / supprime quoi dans la famille
                </p>
              </div>
              <span className="text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </div>
          </Link>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Membres ({members.length})</h2>
          <TeamMembers
            teamId={teamId}
            currentUserId={session.id}
            canManage={canManage}
            isOwner={m.role === "OWNER"}
            members={members.map((mem) => ({
              id: mem.id,
              userId: mem.user.id,
              email: mem.user.email,
              name: mem.user.name,
              image: mem.user.image,
              role: mem.role,
            }))}
          />
        </div>

        {canManage && invites.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Invitations en attente ({invites.length})</h2>
            <TeamInvites
              teamId={teamId}
              invites={invites.map((inv) => ({
                id: inv.id,
                email: inv.email,
                role: inv.role,
                token: inv.token,
                expiresAt: inv.expiresAt.toISOString(),
              }))}
            />
          </div>
        )}
      </main>
    </>
  );
}
