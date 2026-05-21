// Supprime une passkey du user.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  const passkey = await db.passkey.findFirst({ where: { id, userId: session.id } });
  if (!passkey) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await db.passkey.delete({ where: { id } });
  await logActivity({
    userId: session.id,
    action: "passkey.remove",
    req,
    metadata: { deviceName: passkey.deviceName },
  });
  return NextResponse.json({ ok: true });
}
