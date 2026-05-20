import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getMembership, canManageMembers } from "@/lib/teams";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ teamId: string; inviteId: string }> }
) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { teamId, inviteId } = await params;
  const m = await getMembership(teamId, session.id);
  if (!m || !canManageMembers(m.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  await db.invite.delete({ where: { id: inviteId } });
  return NextResponse.json({ ok: true });
}
