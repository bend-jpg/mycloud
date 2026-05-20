import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getMembership, isOwner, canManageMembers } from "@/lib/teams";

export async function GET(
  _req: Request,
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
  if (!m) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const [members, invites] = await Promise.all([
    db.membership.findMany({
      where: { teamId },
      include: { user: { select: { id: true, email: true, name: true, image: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    db.invite.findMany({
      where: { teamId, acceptedAt: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    team: {
      id: m.team.id,
      name: m.team.name,
      type: m.team.type,
      ownerId: m.team.ownerId,
    },
    role: m.role,
    members: members.map((mem) => ({
      id: mem.id,
      userId: mem.user.id,
      email: mem.user.email,
      name: mem.user.name,
      image: mem.user.image,
      role: mem.role,
      joinedAt: mem.joinedAt,
    })),
    invites: invites.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expiresAt,
      token: inv.token,
    })),
  });
}

const patchSchema = z.object({ name: z.string().min(1).max(80).optional() });

export async function PATCH(
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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  await db.team.update({ where: { id: teamId }, data: parsed.data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
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
  if (!m || !isOwner(m.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  // Note : la cascade Prisma supprime aussi les membres + invites.
  // Les fichiers liés au team sont aussi cascade-deleted (à voir si on garde).
  await db.team.delete({ where: { id: teamId } });
  return NextResponse.json({ ok: true });
}
