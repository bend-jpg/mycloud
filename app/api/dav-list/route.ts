// Listing JSON d'un chemin de l'arborescence — utilisé par le proxy WebDAV
// LOCAL de l'app desktop (desktop/webdav-proxy.js).
//
// Pourquoi ce endpoint existe : Next.js/Vercel ne route PAS la méthode HTTP
// PROPFIND (seules GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS sont supportées),
// donc un client WebDAV ne peut pas parler directement à /api/dav. L'app
// desktop fait tourner un mini serveur WebDAV sur 127.0.0.1 qui traduit
// PROPFIND → GET /api/dav-list (ici), GET fichier → GET /api/dav/<path>,
// PUT → /api/files/upload-url + complete.
//
// Auth : session cookie (le proxy forwarde le cookie du webview Electron).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const url = new URL(req.url);
  const rawPath = url.searchParams.get("path") ?? "";
  const segments = rawPath.split("/").map(decodeURIComponent).filter(Boolean);

  // Descend l'arborescence segment par segment (dossiers perso uniquement)
  let parentId: string | null = null;
  let isFile = false;
  let fileInfo: { id: string; name: string; size: bigint; mimeType: string; uploadedAt: Date } | null = null;

  for (let i = 0; i < segments.length; i++) {
    const name = segments[i];
    const isLast = i === segments.length - 1;
    const folder: { id: string } | null = await db.folder.findFirst({
      where: { ownerId: session.id, parentId, name, isTrash: false, teamId: null },
      select: { id: true },
    });
    if (folder) {
      parentId = folder.id;
      continue;
    }
    if (isLast) {
      const file = await db.file.findFirst({
        where: { ownerId: session.id, folderId: parentId, name, isTrash: false, teamId: null },
        select: { id: true, name: true, size: true, mimeType: true, uploadedAt: true },
      });
      if (file) {
        isFile = true;
        fileInfo = file;
        break;
      }
    }
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (isFile && fileInfo) {
    return NextResponse.json({
      type: "file",
      file: {
        id: fileInfo.id,
        name: fileInfo.name,
        size: fileInfo.size.toString(),
        mimeType: fileInfo.mimeType,
        uploadedAt: fileInfo.uploadedAt.toISOString(),
      },
    });
  }

  // C'est un dossier (ou la racine) → liste son contenu
  const [folders, files] = await Promise.all([
    db.folder.findMany({
      where: { ownerId: session.id, parentId, isTrash: false, teamId: null },
      select: { id: true, name: true, updatedAt: true },
      orderBy: { name: "asc" },
    }),
    db.file.findMany({
      where: { ownerId: session.id, folderId: parentId, isTrash: false, teamId: null },
      select: { id: true, name: true, size: true, mimeType: true, uploadedAt: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    type: "folder",
    folderId: parentId, // null = racine — utilisé par le proxy pour les PUT
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      updatedAt: f.updatedAt.toISOString(),
    })),
    files: files.map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size.toString(),
      mimeType: f.mimeType,
      uploadedAt: f.uploadedAt.toISOString(),
    })),
  });
}
