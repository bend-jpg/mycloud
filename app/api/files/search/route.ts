// GET /api/files/search?q=foo
// Recherche live dans les fichiers et dossiers du user (titre contenant q).
// Limité à 12 résultats max pour rester rapide. Exclut la corbeille.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export async function GET(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ files: [], folders: [] });
  }

  const [files, folders] = await Promise.all([
    db.file.findMany({
      where: {
        ownerId: session.id,
        isTrash: false,
        name: { contains: q, mode: "insensitive" },
      },
      orderBy: { uploadedAt: "desc" },
      take: 8,
      select: { id: true, name: true, mimeType: true, size: true, folderId: true },
    }),
    db.folder.findMany({
      where: {
        ownerId: session.id,
        isTrash: false,
        name: { contains: q, mode: "insensitive" },
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: { id: true, name: true, parentId: true },
    }),
  ]);

  return NextResponse.json({
    files: files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size.toString(),
      folderId: f.folderId,
    })),
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      parentId: f.parentId,
    })),
  });
}
