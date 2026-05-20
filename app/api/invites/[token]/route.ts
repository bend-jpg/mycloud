import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

// GET = infos publiques sur l'invitation (sans accepter)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const inv = await db.invite.findUnique({
    where: { token },
    include: { team: true, invitedBy: { select: { name: true, email: true } } },
  });
  if (!inv) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (inv.acceptedAt) return NextResponse.json({ error: "ALREADY_ACCEPTED" }, { status: 410 });
  if (inv.expiresAt < new Date()) return NextResponse.json({ error: "EXPIRED" }, { status: 410 });
  return NextResponse.json({
    teamName: inv.team.name,
    teamType: inv.team.type,
    email: inv.email,
    role: inv.role,
    invitedBy: inv.invitedBy.name ?? inv.invitedBy.email,
    expiresAt: inv.expiresAt,
  });
}

// POST = accepter (user connecté requis ; n'importe quel mail tant que l'user est loggé)
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { token } = await params;
  const inv = await db.invite.findUnique({ where: { token } });
  if (!inv) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (inv.acceptedAt) return NextResponse.json({ error: "ALREADY_ACCEPTED" }, { status: 410 });
  if (inv.expiresAt < new Date()) return NextResponse.json({ error: "EXPIRED" }, { status: 410 });

  // Existing membership ?
  const existing = await db.membership.findUnique({
    where: { teamId_userId: { teamId: inv.teamId, userId: session.id } },
  });
  if (existing) {
    await db.invite.update({ where: { token }, data: { acceptedAt: new Date() } });
    return NextResponse.json({ ok: true, teamId: inv.teamId, alreadyMember: true });
  }

  await db.$transaction([
    db.membership.create({ data: { teamId: inv.teamId, userId: session.id, role: inv.role } }),
    db.invite.update({ where: { token }, data: { acceptedAt: new Date() } }),
  ]);

  return NextResponse.json({ ok: true, teamId: inv.teamId });
}
