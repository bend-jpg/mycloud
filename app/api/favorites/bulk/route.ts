// POST /api/favorites/bulk
// Body : { fileIds: string[], folderIds: string[], action: "star" | "unstar" }
// Étoile/déstoiler plusieurs items d'un coup. Vérifie la propriété avant.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: { fileIds?: string[]; folderIds?: string[]; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const fileIds = Array.isArray(body.fileIds) ? body.fileIds.filter((x) => typeof x === "string") : [];
  const folderIds = Array.isArray(body.folderIds) ? body.folderIds.filter((x) => typeof x === "string") : [];
  const action = body.action === "unstar" ? "unstar" : "star";
  if (fileIds.length === 0 && folderIds.length === 0) {
    return NextResponse.json({ ok: true, changed: 0 });
  }

  // Vérifie qu'on possède bien ces fichiers / dossiers — sinon on les ignore
  const [ownedFiles, ownedFolders] = await Promise.all([
    fileIds.length === 0
      ? []
      : db.file.findMany({
          where: { id: { in: fileIds }, ownerId: session.id },
          select: { id: true },
        }),
    folderIds.length === 0
      ? []
      : db.folder.findMany({
          where: { id: { in: folderIds }, ownerId: session.id },
          select: { id: true },
        }),
  ]);

  const ownedFileIds = ownedFiles.map((f) => f.id);
  const ownedFolderIds = ownedFolders.map((f) => f.id);

  try {
    if (action === "star") {
      // createMany avec skipDuplicates pour éviter les conflits sur l'unique
      const rows = [
        ...ownedFileIds.map((id) => ({
          userId: session.id,
          targetType: "FILE" as const,
          targetId: id,
        })),
        ...ownedFolderIds.map((id) => ({
          userId: session.id,
          targetType: "FOLDER" as const,
          targetId: id,
        })),
      ];
      const result = await db.favorite.createMany({
        data: rows,
        skipDuplicates: true,
      });
      return NextResponse.json({ ok: true, changed: result.count });
    } else {
      // unstar : delete all matching
      const result = await db.favorite.deleteMany({
        where: {
          userId: session.id,
          OR: [
            { targetType: "FILE", targetId: { in: ownedFileIds } },
            { targetType: "FOLDER", targetId: { in: ownedFolderIds } },
          ],
        },
      });
      return NextResponse.json({ ok: true, changed: result.count });
    }
  } catch {
    return NextResponse.json(
      { error: "FAVORITES_NOT_READY", message: "Favoris pas encore disponibles" },
      { status: 503 },
    );
  }
}
