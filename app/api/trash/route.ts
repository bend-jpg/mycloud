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
import { getMembership, canWrite } from "@/lib/teams";
import { hardDeleteFiles, PURGEABLE_SELECT } from "@/lib/purge-files";

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
    // PAR TRANCHES.
    //
    // La suppression définitive interroge la base plusieurs fois par fichier
    // (versions archivées, comptage de références, miniature partagée). Sur
    // une corbeille de 12 000 fichiers ça représente des dizaines de milliers
    // de requêtes dans un seul appel : le temps maximum d'une fonction serveur
    // est dépassé bien avant la fin, et l'utilisateur voit un échec après une
    // longue attente, sans savoir ce qui a été supprimé ou pas.
    //
    // On en traite un nombre borné et on annonce ce qu'il reste ; le
    // navigateur rappelle jusqu'à ce que la corbeille soit vide, en montrant
    // la progression.
    const EMPTY_SLICE = 300;

    const files = await db.file.findMany({
      where: { ownerId: session.id, isTrash: true },
      select: PURGEABLE_SELECT,
      take: EMPTY_SLICE,
    });
    await hardDeleteFiles(files, session.id);

    // Les dossiers ne partent qu'une fois tous les fichiers traités : tant
    // qu'il en reste, un dossier supprimé rendrait les suivants introuvables.
    const remainingFiles = await db.file.count({ where: { ownerId: session.id, isTrash: true } });
    let deletedFolders = 0;
    if (remainingFiles === 0) {
      const folders = await db.folder.findMany({
        where: { ownerId: session.id, isTrash: true, teamId: null },
        select: { id: true },
      });
      if (folders.length > 0) {
        const r = await db.folder.deleteMany({ where: { id: { in: folders.map((f) => f.id) } } });
        deletedFolders = r.count;
      }
    }

    return NextResponse.json({
      ok: true,
      deletedFiles: files.length,
      deletedFolders,
      // Le navigateur rappelle tant que ce nombre n'est pas nul.
      remaining: remainingFiles,
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
    // thumbnailKey inclus : sans lui, la miniature restait dans le bucket
    // après suppression définitive, facturée indéfiniment.
    select: PURGEABLE_SELECT,
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
