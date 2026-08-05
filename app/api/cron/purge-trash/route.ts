// Purge automatique de la corbeille — tâche planifiée quotidienne.
//
// Supprime définitivement les fichiers et dossiers mis à la corbeille il y a
// plus de TRASH_RETENTION_DAYS jours : objets de stockage compris, quota
// rendu au client.
//
// ─────────────────────────────────────────────────────────────────────────
// AUTHENTIFICATION
// ─────────────────────────────────────────────────────────────────────────
//
// Cette route DÉTRUIT des données. Elle est protégée par un secret partagé
// que Vercel envoie dans l'en-tête Authorization lors de l'appel planifié.
//
// Si CRON_SECRET n'est pas défini, la route REFUSE de s'exécuter. Le réflexe
// inverse — « pas de secret configuré, donc on laisse passer » — transforme
// un oubli de configuration en route de suppression ouverte à tous.
//
// ─────────────────────────────────────────────────────────────────────────
// LOTS
// ─────────────────────────────────────────────────────────────────────────
//
// Le traitement est limité par exécution : une fonction serverless a un temps
// maximum, et supprimer des milliers d'objets pourrait le dépasser et laisser
// la base dans un état à moitié traité. Le reliquat part à l'exécution
// suivante — la tâche tourne tous les jours.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hardDeleteFiles, PURGEABLE_SELECT } from "@/lib/purge-files";
import { trashCutoffDate, TRASH_RETENTION_DAYS } from "@/lib/trash-retention";

export const runtime = "nodejs";
// Jamais mise en cache : une route qui détruit des données doit s'exécuter
// réellement à chaque appel.
export const dynamic = "force-dynamic";

const MAX_FILES_PER_RUN = 500;
const MAX_FOLDERS_PER_RUN = 500;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Pas de secret configuré → on refuse. Voir la note ci-dessus.
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const cutoff = trashCutoffDate();

  const files = await db.file.findMany({
    where: { isTrash: true, deletedAt: { not: null, lte: cutoff } },
    select: PURGEABLE_SELECT,
    take: MAX_FILES_PER_RUN,
    orderBy: { deletedAt: "asc" }, // les plus anciens d'abord
  });

  const stats = await hardDeleteFiles(files);

  // Les dossiers ne portent aucun objet de stockage. On les supprime APRÈS
  // les fichiers : si un fichier échouait à partir, son dossier parent doit
  // rester pour qu'il reste atteignable.
  const staleFolders = await db.folder.findMany({
    where: { isTrash: true, deletedAt: { not: null, lte: cutoff } },
    select: { id: true },
    take: MAX_FOLDERS_PER_RUN,
    orderBy: { deletedAt: "asc" },
  });

  let deletedFolders = 0;
  for (const folder of staleFolders) {
    // Un dossier encore peuplé n'est pas supprimé : ses fichiers n'ont pas
    // atteint l'échéance, ils partiront plus tard avec lui.
    const remaining = await db.file.count({ where: { folderId: folder.id } });
    const children = await db.folder.count({ where: { parentId: folder.id } });
    if (remaining > 0 || children > 0) continue;
    await db.folder.delete({ where: { id: folder.id } }).catch(() => {});
    deletedFolders++;
  }

  const result = {
    ok: true,
    retentionDays: TRASH_RETENTION_DAYS,
    cutoff: cutoff.toISOString(),
    ...stats,
    deletedFolders,
    // Indique s'il reste du travail : utile pour savoir si un lot a été
    // atteint et si la purge doit être relancée plus tôt.
    moreRemaining: files.length === MAX_FILES_PER_RUN,
  };

  console.log("[cron/purge-trash]", JSON.stringify(result));
  return NextResponse.json(result);
}
