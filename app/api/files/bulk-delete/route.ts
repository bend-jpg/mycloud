// POST /api/files/bulk-delete — met à la corbeille plusieurs fichiers et
// dossiers en UNE seule requête.
//
// ─────────────────────────────────────────────────────────────────────────
// CE QUE FAISAIT L'INTERFACE AVANT
// ─────────────────────────────────────────────────────────────────────────
//
// Elle envoyait une requête DELETE PAR ÉLÉMENT, toutes en même temps :
//
//     await Promise.all([...selected].map((id) => fetch(`/api/files/${id}`, …)))
//
// Deux défauts, et le second est le pire :
//
//   1. Sélectionner 12 000 fichiers lançait 12 000 requêtes simultanées. Le
//      serveur ne suivait pas et la plupart échouaient.
//
//   2. AUCUNE réponse n'était vérifiée. `fetch` ne rejette que sur une panne
//      réseau : une réponse « erreur serveur » est considérée comme réussie.
//      L'interface affichait donc « 12 252 éléments déplacés en corbeille »
//      alors que rien n'avait été supprimé.
//
// Un message de réussite sur un échec total : l'utilisateur n'avait aucun
// moyen de comprendre pourquoi ses fichiers étaient toujours là.
//
// Ici, tout se fait en deux requêtes de base, et le nombre renvoyé est le
// nombre RÉELLEMENT modifié.

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getMembership, canWrite } from "@/lib/teams";
import { collectFolderSubtree } from "@/lib/folder-tree";

export const runtime = "nodejs";

// Borne haute par requête. Au-delà, l'interface découpe : une transaction
// démesurée finirait par dépasser le temps maximum d'une fonction serveur et
// échouerait entièrement, ne supprimant rien.
const MAX_ITEMS = 5000;

const schema = z.object({
  fileIds: z.array(z.string()).max(MAX_ITEMS).optional(),
  folderIds: z.array(z.string()).max(MAX_ITEMS).optional(),
  teamId: z.string().nullable().optional(),
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

  const fileIds = parsed.data.fileIds ?? [];
  const folderIds = parsed.data.folderIds ?? [];
  const teamId = parsed.data.teamId ?? null;
  if (fileIds.length === 0 && folderIds.length === 0) {
    return NextResponse.json({ error: "EMPTY_SELECTION" }, { status: 400 });
  }

  // Sur un espace partagé, c'est le rôle qui décide — pas la propriété.
  if (teamId) {
    const m = await getMembership(teamId, session.id);
    if (!m || !canWrite(m.role)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // Le filtre de portée est appliqué DANS les requêtes de mise à jour : on ne
  // supprime jamais que ce qui appartient à l'appelant (ou à l'espace où il a
  // le droit d'écrire). Un identifiant étranger glissé dans la liste ne
  // correspond alors simplement à rien.
  const scope = teamId ? { teamId } : { ownerId: session.id, teamId: null };
  const now = new Date();

  // Les dossiers emportent toute leur descendance, fichiers compris.
  const allFolderIds =
    folderIds.length > 0
      ? await collectFolderSubtree(folderIds, { teamId, ownerId: session.id })
      : [];

  const [folders, filesInFolders, files] = await db.$transaction([
    allFolderIds.length > 0
      ? db.folder.updateMany({
          where: { id: { in: allFolderIds }, ...scope, isTrash: false },
          data: { isTrash: true, deletedAt: now },
        })
      : db.folder.updateMany({ where: { id: "" }, data: {} }),
    allFolderIds.length > 0
      ? db.file.updateMany({
          where: { folderId: { in: allFolderIds }, ...scope, isTrash: false },
          data: { isTrash: true, deletedAt: now },
        })
      : db.file.updateMany({ where: { id: "" }, data: {} }),
    fileIds.length > 0
      ? db.file.updateMany({
          where: { id: { in: fileIds }, ...scope, isTrash: false },
          data: { isTrash: true, deletedAt: now },
        })
      : db.file.updateMany({ where: { id: "" }, data: {} }),
  ]);

  const deletedFiles = files.count + filesInFolders.count;

  return NextResponse.json({
    ok: true,
    // Nombres RÉELLEMENT modifiés en base, pas le nombre demandé : c'est ce
    // qui permet à l'interface de dire la vérité.
    deletedFiles,
    deletedFolders: folders.count,
    requestedFiles: fileIds.length,
    requestedFolders: folderIds.length,
  });
}
