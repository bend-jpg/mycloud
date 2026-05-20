import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getMembership, canManageMembers } from "@/lib/teams";
import { getAppUrl } from "@/lib/url";
import { sendEmail, inviteEmail, isEmailConfigured } from "@/lib/email";

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["VIEWER", "EDITOR", "ADMIN"]).default("VIEWER"),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { teamId } = await params;
  const m = await getMembership(teamId, session.id);
  if (!m || !canManageMembers(m.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  const { email, role, expiresInDays } = parsed.data;

  // Vérifie limite membres du plan
  const owner = await db.user.findUnique({
    where: { id: m.team.ownerId },
    include: { plan: true },
  });
  const memberCount = await db.membership.count({ where: { teamId } });
  if (owner?.plan && memberCount >= owner.plan.maxMembers) {
    return NextResponse.json({ error: "MEMBER_LIMIT_REACHED" }, { status: 403 });
  }

  // Si user existe déjà avec ce mail, on peut le rendre membre direct ? Non —
  // on garde le flux invitation pour pouvoir documenter qui a invité qui.
  const token = nanoid(24);
  const invite = await db.invite.create({
    data: {
      teamId,
      email: email.toLowerCase(),
      role,
      token,
      invitedById: session.id,
      expiresAt: new Date(Date.now() + expiresInDays * 86400_000),
    },
  });

  const baseUrl = getAppUrl();
  const inviteUrl = `${baseUrl}/invite/${invite.token}`;

  // Envoi email si Resend configuré (sinon le client doit copier le lien manuellement)
  let emailSent = false;
  if (isEmailConfigured()) {
    const inviterName = session.name || session.email;
    const tpl = inviteEmail(m.team.name, inviterName, role, inviteUrl);
    const res = await sendEmail({ to: invite.email, ...tpl });
    emailSent = res.ok;
  }

  return NextResponse.json({
    ok: true,
    emailSent,
    invite: {
      id: invite.id,
      token: invite.token,
      email: invite.email,
      role: invite.role,
      url: inviteUrl,
      expiresAt: invite.expiresAt,
    },
  });
}
