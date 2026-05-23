// DELETE /api/file-requests/[id] — révoque un file request (set revokedAt)

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const updated = await db.fileRequest.updateMany({
      where: { id, ownerId: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "REVOKE_FAILED" }, { status: 500 });
  }
}
