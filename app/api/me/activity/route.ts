// Permet à l'utilisateur d'effacer son activity log.
// DELETE → vide tout l'historique du user (utile pour confidentialité).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export async function DELETE() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const r = await db.activityLog.deleteMany({ where: { userId: session.id } });
  return NextResponse.json({ ok: true, deleted: r.count });
}
