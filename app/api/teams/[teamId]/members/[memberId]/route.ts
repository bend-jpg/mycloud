import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getMembership, canManageMembers, isOwner } from "@/lib/teams";

const patchSchema = z.object({
  role: z.enum(["VIEWER", "EDITOR", "ADMIN", "OWNER"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ teamId: string; memberId: string }> }
) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { teamId, memberId } = await params;
  const m = await getMembership(teamId, session.id);
  if (!m || !canManageMembers(m.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  // Seul un OWNER peut promouvoir en OWNER (transfert)
  if (parsed.data.role === "OWNER" && !isOwner(m.role)) {
    return NextResponse.json({ error: "FORBIDDEN_OWNER_TRANSFER" }, { status: 403 });
  }
  await db.membership.update({ where: { id: memberId }, data: { role: parsed.data.role } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ teamId: string; memberId: string }> }
) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { teamId, memberId } = await params;
  const m = await getMembership(teamId, session.id);
  if (!m || !canManageMembers(m.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const target = await db.membership.findUnique({ where: { id: memberId } });
  if (!target) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (target.role === "OWNER") {
    return NextResponse.json({ error: "CANT_REMOVE_OWNER" }, { status: 400 });
  }
  await db.membership.delete({ where: { id: memberId } });
  return NextResponse.json({ ok: true });
}
