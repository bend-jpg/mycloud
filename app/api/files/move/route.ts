// Déplace une sélection de fichiers et/ou dossiers dans un autre dossier.
// Utilisé par le drag-drop dans la grille.
//
// POST { fileIds?: string[], folderIds?: string[], targetFolderId: string | null, targetTeamId?: string | null }
//   - targetFolderId = null → racine
//   - targetTeamId = null → espace perso, sinon team
//
// On vérifie que l'utilisateur a le droit d'éditer (owner OU EDITOR+ sur le team) à
// la fois sur la source ET la destination. Une opération échouée laisse le reste intact.

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getMembership, canWrite } from "@/lib/teams";

const schema = z.object({
  fileIds: z.array(z.string()).optional(),
  folderIds: z.array(z.string()).optional(),
  targetFolderId: z.string().nullable(),
  targetTeamId: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const { fileIds = [], folderIds = [], targetFolderId, targetTeamId } = parsed.data;

  if (fileIds.length === 0 && folderIds.length === 0) {
    return NextResponse.json({ error: "NOTHING_TO_MOVE" }, { status: 400 });
  }

  // Si destination = team, vérifie droit d'écriture sur le team
  const destTeamId = targetTeamId ?? null;
  if (destTeamId) {
    const m = await getMembership(destTeamId, session.id);
    if (!m || !canWrite(m.role)) {
      return NextResponse.json({ error: "DEST_FORBIDDEN" }, { status: 403 });
    }
  }

  // Valider le dossier destination s'il existe
  if (targetFolderId) {
    const dest = await db.folder.findFirst({
      where: { id: targetFolderId, isTrash: false },
      select: { id: true, ownerId: true, teamId: true },
    });
    if (!dest) return NextResponse.json({ error: "TARGET_NOT_FOUND" }, { status: 404 });
    // dest doit appartenir au même contexte (perso ou même team)
    if (destTeamId && dest.teamId !== destTeamId) {
      return NextResponse.json({ error: "TARGET_MISMATCH" }, { status: 400 });
    }
    if (!destTeamId && (dest.teamId || dest.ownerId !== session.id)) {
      return NextResponse.json({ error: "TARGET_FORBIDDEN" }, { status: 403 });
    }
  }

  // Charge fichiers source pour vérifier droits
  const sourceFiles =
    fileIds.length > 0
      ? await db.file.findMany({
          where: { id: { in: fileIds }, isTrash: false },
          select: { id: true, ownerId: true, teamId: true },
        })
      : [];
  for (const f of sourceFiles) {
    let allowed = f.ownerId === session.id;
    if (!allowed && f.teamId) {
      const m = await getMembership(f.teamId, session.id);
      allowed = !!m && canWrite(m.role);
    }
    if (!allowed) {
      return NextResponse.json({ error: "SOURCE_FORBIDDEN", fileId: f.id }, { status: 403 });
    }
  }

  // Charge dossiers source pour vérifier droits
  const sourceFolders =
    folderIds.length > 0
      ? await db.folder.findMany({
          where: { id: { in: folderIds }, isTrash: false },
          select: { id: true, ownerId: true, teamId: true },
        })
      : [];
  for (const f of sourceFolders) {
    let allowed = f.ownerId === session.id;
    if (!allowed && f.teamId) {
      const m = await getMembership(f.teamId, session.id);
      allowed = !!m && canWrite(m.role);
    }
    if (!allowed) {
      return NextResponse.json({ error: "SOURCE_FORBIDDEN", folderId: f.id }, { status: 403 });
    }
    // Empêche déplacer un dossier dans lui-même ou un de ses descendants
    if (targetFolderId && (await isDescendant(targetFolderId, f.id))) {
      return NextResponse.json({ error: "CIRCULAR", folderId: f.id }, { status: 400 });
    }
    if (targetFolderId === f.id) {
      return NextResponse.json({ error: "CIRCULAR", folderId: f.id }, { status: 400 });
    }
  }

  // Update en batch
  await db.$transaction([
    ...(fileIds.length > 0
      ? [
          db.file.updateMany({
            where: { id: { in: fileIds } },
            data: { folderId: targetFolderId, teamId: destTeamId },
          }),
        ]
      : []),
    ...(folderIds.length > 0
      ? [
          db.folder.updateMany({
            where: { id: { in: folderIds } },
            data: { parentId: targetFolderId, teamId: destTeamId },
          }),
        ]
      : []),
  ]);

  return NextResponse.json({
    ok: true,
    movedFiles: fileIds.length,
    movedFolders: folderIds.length,
  });
}

/** Renvoie true si `descendantId` est `ancestorId` ou un sous-dossier de `ancestorId`. */
async function isDescendant(descendantId: string, ancestorId: string): Promise<boolean> {
  let current: { id: string; parentId: string | null } | null = await db.folder.findUnique({
    where: { id: descendantId },
    select: { id: true, parentId: true },
  });
  while (current) {
    if (current.id === ancestorId) return true;
    if (!current.parentId) return false;
    current = await db.folder.findUnique({
      where: { id: current.parentId },
      select: { id: true, parentId: true },
    });
  }
  return false;
}
