// Actions en masse sur la corbeille :
//   POST { action: "restore", fileIds?, folderIds? }     → ressort de la corbeille
//   POST { action: "delete", fileIds?, folderIds? }      → supprime définitivement (R2 + DB)
//   POST { action: "empty" }                              → vide totalement la corbeille du user
//
// Sécurité : on n'agit que sur les items appartenant au user (owner perso OU team
// avec rôle EDITOR+). L'admin n'a pas accès à la corbeille des autres ici (passe par
// la fiche client si besoin).

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { getMembership, canWrite } from "@/lib/teams";

const schema = z.object({
  action: z.enum(["restore", "delete", "empty"]),
  fileIds: z.array(z.string()).optional(),
  folderIds: z.array(z.string()).optional(),
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
  const { action } = parsed.data;

  // EMPTY : on récupère tous les items perso de l'utilisateur en corbeille puis on delete.
  if (action === "empty") {
    const files = await db.file.findMany({
      where: { ownerId: session.id, isTrash: true },
      select: { id: true, storageKey: true, storageBackendId: true, size: true, teamId: true },
    });
    const folders = await db.folder.findMany({
      where: { ownerId: session.id, isTrash: true, teamId: null },
      select: { id: true },
    });
    await hardDeleteFiles(files, session.id);
    if (folders.length > 0) {
      await db.folder.deleteMany({ where: { id: { in: folders.map((f) => f.id) } } });
    }
    return NextResponse.json({
      ok: true,
      deletedFiles: files.length,
      deletedFolders: folders.length,
    });
  }

  // RESTORE / DELETE individuel
  const fileIds = parsed.data.fileIds ?? [];
  const folderIds = parsed.data.folderIds ?? [];
  if (fileIds.length === 0 && folderIds.length === 0) {
    return NextResponse.json({ error: "EMPTY_SELECTION" }, { status: 400 });
  }

  // Charge + vérif droits
  const files = await db.file.findMany({
    where: { id: { in: fileIds }, isTrash: true },
    select: { id: true, ownerId: true, teamId: true, storageKey: true, storageBackendId: true, size: true },
  });
  const folders = await db.folder.findMany({
    where: { id: { in: folderIds }, isTrash: true },
    select: { id: true, ownerId: true, teamId: true },
  });

  async function isAllowed(item: { ownerId: string; teamId: string | null }): Promise<boolean> {
    if (!item.teamId) return item.ownerId === session!.id;
    const m = await getMembership(item.teamId, session!.id);
    return !!m && canWrite(m.role);
  }
  for (const f of files) if (!(await isAllowed(f))) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  for (const f of folders) if (!(await isAllowed(f))) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  if (action === "restore") {
    await db.$transaction([
      ...(files.length > 0
        ? [
            db.file.updateMany({
              where: { id: { in: files.map((f) => f.id) } },
              data: { isTrash: false, deletedAt: null },
            }),
          ]
        : []),
      ...(folders.length > 0
        ? [
            db.folder.updateMany({
              where: { id: { in: folders.map((f) => f.id) } },
              data: { isTrash: false, deletedAt: null },
            }),
          ]
        : []),
    ]);
    return NextResponse.json({ ok: true, restoredFiles: files.length, restoredFolders: folders.length });
  }

  // DELETE définitif
  await hardDeleteFiles(files, session.id);
  if (folders.length > 0) {
    await db.folder.deleteMany({ where: { id: { in: folders.map((f) => f.id) } } });
  }
  return NextResponse.json({ ok: true, deletedFiles: files.length, deletedFolders: folders.length });
}

/**
 * Hard delete avec ref counting sur storageKey (un blob R2 peut être référencé par
 * plusieurs File rows à cause du partage famille).
 */
async function hardDeleteFiles(
  files: { id: string; storageKey: string; storageBackendId: string; size: bigint; teamId: string | null }[],
  userId: string,
) {
  if (files.length === 0) return;

  for (const f of files) {
    const otherRefs = await db.file.count({
      where: {
        storageKey: f.storageKey,
        storageBackendId: f.storageBackendId,
        NOT: { id: f.id },
      },
    });
    if (otherRefs === 0) {
      try {
        const storage = await getStorage(f.storageBackendId);
        await storage.deleteObject(f.storageKey);
      } catch {
        // ignore — on persiste la suppression DB même si R2 fail
      }
    }

    // Quota : décrémente côté owner du team si team, sinon owner du file
    let quotaUserId = f.teamId
      ? (await db.team.findUnique({ where: { id: f.teamId }, select: { ownerId: true } }))?.ownerId
      : userId;
    if (!quotaUserId) quotaUserId = userId;

    await db.$transaction([
      db.file.delete({ where: { id: f.id } }),
      db.user.update({ where: { id: quotaUserId }, data: { storageUsed: { decrement: f.size } } }),
      ...(otherRefs === 0
        ? [
            db.storageBackend.update({
              where: { id: f.storageBackendId },
              data: { usedBytes: { decrement: f.size } },
            }),
          ]
        : []),
    ]);
  }
}
