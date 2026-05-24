// Stockage utilisé/quota du user courant. Utilisé par la sidebar de l'app
// desktop pour afficher la mini-jauge en bas, et potentiellement par d'autres
// surfaces qui veulent juste les chiffres bruts sans le reste de /api/me.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { storageUsed: true, storageQuota: true },
  });
  if (!user) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  return NextResponse.json({
    used: user.storageUsed.toString(),
    quota: user.storageQuota.toString(),
  });
}
