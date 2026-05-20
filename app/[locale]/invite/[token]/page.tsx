import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { Link } from "@/i18n/navigation";
import { Cloud, Users, Briefcase } from "lucide-react";
import { InviteAcceptButton } from "@/components/invite-accept-button";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const inv = await db.invite.findUnique({
    where: { token },
    include: {
      team: true,
      invitedBy: { select: { name: true, email: true } },
    },
  });
  if (!inv) notFound();

  const expired = inv.expiresAt < new Date();
  const alreadyAccepted = !!inv.acceptedAt;

  const session = await getSession();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold mb-10">
        <Cloud className="size-6 text-[var(--accent)]" />
        MyCloud
      </Link>

      <div className="w-full max-w-md">
        <div className="tile cursor-default !p-8 text-center">
          <div className="tile-icon mx-auto !size-16 !rounded-2xl mb-4">
            {inv.team.type === "FAMILY" ? <Users className="size-8" /> : <Briefcase className="size-8" />}
          </div>
          <h1 className="text-2xl font-bold">{inv.team.name}</h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-2">
            <span className="text-[var(--foreground)]">
              {inv.invitedBy.name ?? inv.invitedBy.email}
            </span>{" "}
            t&apos;invite à rejoindre{" "}
            {inv.team.type === "FAMILY" ? "cet espace familial" : "ce workspace"}.
          </p>

          <div className="my-6 inline-flex rounded-full border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-1.5 text-sm">
            Rôle proposé :{" "}
            <span className="font-medium text-[var(--accent)] ms-1">
              {inv.role === "VIEWER" ? "Lecture" : inv.role === "EDITOR" ? "Édition" : "Admin"}
            </span>
          </div>

          {alreadyAccepted ? (
            <p className="text-sm text-[var(--success)]">Tu as déjà accepté cette invitation.</p>
          ) : expired ? (
            <p className="text-sm text-[var(--danger)]">Cette invitation a expiré.</p>
          ) : !session ? (
            <Link href="/login" className="btn-primary w-full justify-center">
              Se connecter pour accepter
            </Link>
          ) : (
            <InviteAcceptButton token={token} teamId={inv.teamId} />
          )}
        </div>
      </div>
    </main>
  );
}
