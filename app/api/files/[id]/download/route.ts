import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { getMembership, canRead } from "@/lib/teams";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const file = await db.file.findFirst({ where: { id, isTrash: false } });
  if (!file) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Accès : owner du fichier OU membre du team avec rôle lecture
  let allowed = file.ownerId === session.id;
  if (!allowed && file.teamId) {
    const m = await getMembership(file.teamId, session.id);
    allowed = !!m && canRead(m.role);
  }
  if (!allowed) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const storage = await getStorage(file.storageBackendId);
  const presigned = await storage.createPresignedDownload(file.storageKey, file.name, 3600);

  return NextResponse.redirect(presigned.url, 302);
}
