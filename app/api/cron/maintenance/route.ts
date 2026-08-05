// Maintenance nocturne — tâche planifiée quotidienne.
//
// Deux travaux, réunis dans une seule tâche pour n'avoir qu'un secret à gérer
// et rester dans les limites de tâches planifiées de l'hébergeur :
//
//   1. Purge de la corbeille : suppression définitive des fichiers et
//      dossiers jetés il y a plus de TRASH_RETENTION_DAYS jours.
//   2. Purge des versions : suppression des versions précédentes échues
//      (au-delà de VERSION_RETENTION_HOURS) ou en trop.
//
// ─────────────────────────────────────────────────────────────────────────
// AUTHENTIFICATION
// ─────────────────────────────────────────────────────────────────────────
//
// Cette route DÉTRUIT des données. Elle est protégée par un secret partagé
// envoyé par l'hébergeur dans l'en-tête Authorization.
//
// Si CRON_SECRET n'est pas défini, la route REFUSE de s'exécuter. Le réflexe
// inverse — « pas de secret configuré, donc on laisse passer » — transforme
// un oubli de configuration en route de suppression ouverte à tous.
//
// ─────────────────────────────────────────────────────────────────────────
// LOTS
// ─────────────────────────────────────────────────────────────────────────
//
// Le traitement est plafonné par exécution : une fonction serverless a un
// temps maximum, et supprimer des milliers d'objets pourrait le dépasser en
// laissant la base à moitié traitée. Le reliquat part le lendemain, et
// `moreRemaining` signale qu'il en reste.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hardDeleteFiles, PURGEABLE_SELECT } from "@/lib/purge-files";
import { trashCutoffDate, TRASH_RETENTION_DAYS } from "@/lib/trash-retention";
import { cleanupFileVersions, VERSION_RETENTION_HOURS } from "@/lib/file-versions";

export const runtime = "nodejs";
// Jamais mise en cache : une route qui détruit des données doit s'exécuter
// réellement à chaque appel.
export const dynamic = "force-dynamic";

const MAX_FILES_PER_RUN = 500;
const MAX_FOLDERS_PER_RUN = 500;
const MAX_VERSION_FILES_PER_RUN = 500;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = new Date();

  // ───────────── 1. Corbeille ─────────────
  const cutoff = trashCutoffDate(now);

  const files = await db.file.findMany({
    where: { isTrash: true, deletedAt: { not: null, lte: cutoff } },
    select: PURGEABLE_SELECT,
    take: MAX_FILES_PER_RUN,
    orderBy: { deletedAt: "asc" }, // les plus anciens d'abord
  });

  const trashStats = await hardDeleteFiles(files);

  // Les dossiers ne portent aucun objet de stockage. Traités APRÈS les
  // fichiers : si un fichier échouait à partir, son dossier parent doit
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

  // ───────────── 2. Versions échues ─────────────
  //
  // On cherche les versions non courantes dont le délai est dépassé, puis on
  // nettoie fichier par fichier. Le nettoyage complet est délégué à
  // cleanupFileVersions : c'est lui qui sait distinguer une archive réelle
  // d'un doublon pointant vers le fichier vivant — distinction sans laquelle
  // on détruirait le contenu actuel.
  const versionCutoff = new Date(now.getTime() - VERSION_RETENTION_HOURS * 60 * 60 * 1000);

  const expired = await db.fileVersion.findMany({
    where: {
      isCurrent: false,
      OR: [
        { supersededAt: { not: null, lte: versionCutoff } },
        // Lignes créées avant l'ajout de supersededAt : on retombe sur la
        // date d'envoi.
        { supersededAt: null, uploadedAt: { lte: versionCutoff } },
      ],
    },
    select: { fileId: true },
    take: MAX_VERSION_FILES_PER_RUN * 4, // plusieurs versions par fichier
  });

  const fileIds = Array.from(new Set(expired.map((v) => v.fileId))).slice(0, MAX_VERSION_FILES_PER_RUN);

  let versionRows = 0;
  let versionObjects = 0;
  let versionErrors = 0;
  for (const fileId of fileIds) {
    const s = await cleanupFileVersions(fileId, now);
    versionRows += s.deletedRows;
    versionObjects += s.deletedObjects;
    versionErrors += s.storageErrors;
  }

  const result = {
    ok: true,
    trash: {
      retentionDays: TRASH_RETENTION_DAYS,
      cutoff: cutoff.toISOString(),
      ...trashStats,
      deletedFolders,
      moreRemaining: files.length === MAX_FILES_PER_RUN,
    },
    versions: {
      retentionHours: VERSION_RETENTION_HOURS,
      cutoff: versionCutoff.toISOString(),
      filesProcessed: fileIds.length,
      deletedRows: versionRows,
      deletedObjects: versionObjects,
      storageErrors: versionErrors,
      moreRemaining: fileIds.length === MAX_VERSION_FILES_PER_RUN,
    },
  };

  console.log("[cron/maintenance]", JSON.stringify(result));
  return NextResponse.json(result);
}
