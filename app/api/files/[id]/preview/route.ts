// Aperçu inline d'un fichier (sans forcer le téléchargement).
// Utilisé pour les thumbnails dans la grille et le modal de preview.

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
  // Admin peut tout voir (pour la page /admin/clients/[id]/files)
  if (!allowed && session.isAdmin) allowed = true;
  if (!allowed) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const storage = await getStorage(file.storageBackendId);
  // ⚠️ on passe undefined comme fileName → pas de Content-Disposition: attachment
  // → le navigateur affiche en inline (idéal pour <img>, <iframe>, <video>)
  const presigned = await storage.createPresignedDownload(file.storageKey, undefined, 3600);

  // Cache 5 min côté navigateur pour limiter les re-fetch des thumbnails
  return NextResponse.redirect(presigned.url, {
    status: 302,
    headers: {
      "Cache-Control": "private, max-age=300",
    },
  });
}
