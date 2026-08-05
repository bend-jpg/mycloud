// Suppression DÉFINITIVE de fichiers : base de données ET objets stockés.
//
// ─────────────────────────────────────────────────────────────────────────
// POURQUOI CETTE FONCTION EXISTE
// ─────────────────────────────────────────────────────────────────────────
//
// La suppression définitive était écrite à trois endroits (suppression d'un
// fichier, vidage de la corbeille, et maintenant la purge automatique), avec
// à chaque fois une variante du même code. Toutes les trois oubliaient la
// même chose :
//
//   - la MINIATURE (thumbnailKey) restait dans le bucket
//   - toutes les VERSIONS ARCHIVÉES restaient dans le bucket
//
// Les lignes disparaissaient de la base, mais on continuait de payer le
// stockage de ces objets — indéfiniment, et sans aucun moyen de les
// retrouver puisque plus rien ne les référençait.
//
// ─────────────────────────────────────────────────────────────────────────
// COMPTAGE DE RÉFÉRENCES
// ─────────────────────────────────────────────────────────────────────────
//
// Le partage familial crée plusieurs lignes File pointant vers la MÊME clé
// de stockage, pour ne pas dupliquer les octets. Supprimer aveuglément
// casserait donc le fichier encore visible chez l'autre membre.
//
// La miniature est dérivée de la clé principale (`clé.thumb.jpg`) : elle est
// donc partagée elle aussi et doit être comptée séparément.
//
// Les versions archivées, elles, appartiennent à un seul fichier : leur clé
// dérive d'un horodatage propre à l'enregistrement qui les a créées.

import { db } from "./db";
import { getStorage } from "./storage";

export interface PurgeableFile {
  id: string;
  storageKey: string;
  thumbnailKey: string | null;
  storageBackendId: string;
  size: bigint;
  ownerId: string;
  teamId: string | null;
}

export interface PurgeStats {
  /** Lignes File supprimées de la base. */
  deletedFiles: number;
  /** Objets réellement supprimés du stockage. */
  deletedObjects: number;
  /** Objets conservés car encore référencés par quelqu'un d'autre. */
  keptSharedObjects: number;
  /** Objets dont la suppression a échoué (backend injoignable). */
  storageErrors: number;
}

/**
 * Supprime définitivement des fichiers : objets de stockage puis lignes de
 * base, avec ajustement du quota.
 *
 * @param fallbackQuotaUserId compte à débiter si le fichier n'appartient pas
 *        à une équipe et que son propriétaire est inconnu du contexte.
 */
export async function hardDeleteFiles(
  files: PurgeableFile[],
  fallbackQuotaUserId?: string,
): Promise<PurgeStats> {
  const stats: PurgeStats = {
    deletedFiles: 0,
    deletedObjects: 0,
    keptSharedObjects: 0,
    storageErrors: 0,
  };

  for (const file of files) {
    // 1. Les versions archivées de CE fichier — jamais partagées.
    const versions = await db.fileVersion.findMany({
      where: { fileId: file.id },
      select: { storageKey: true, storageBackendId: true },
    });

    // 2. La clé principale n'est supprimable que si aucune autre ligne File
    //    ne la référence.
    const otherRefs = await db.file.count({
      where: {
        storageKey: file.storageKey,
        storageBackendId: file.storageBackendId,
        NOT: { id: file.id },
      },
    });

    // 3. La miniature dérive de la clé principale, donc elle est partagée
    //    dans les mêmes conditions — on la compte quand même à part, au cas
    //    où la convention de nommage changerait un jour.
    let thumbShared = false;
    if (file.thumbnailKey) {
      const thumbRefs = await db.file.count({
        where: {
          thumbnailKey: file.thumbnailKey,
          storageBackendId: file.storageBackendId,
          NOT: { id: file.id },
        },
      });
      thumbShared = thumbRefs > 0;
    }

    // 4. Regroupe les clés à supprimer par backend.
    const byBackend = new Map<string, Set<string>>();
    const addKey = (backendId: string, key: string) => {
      const set = byBackend.get(backendId) ?? new Set<string>();
      set.add(key);
      byBackend.set(backendId, set);
    };

    for (const v of versions) addKey(v.storageBackendId, v.storageKey);
    if (otherRefs === 0) addKey(file.storageBackendId, file.storageKey);
    else stats.keptSharedObjects++;
    if (file.thumbnailKey && !thumbShared) addKey(file.storageBackendId, file.thumbnailKey);
    else if (file.thumbnailKey) stats.keptSharedObjects++;

    for (const [backendId, keys] of byBackend) {
      const list = Array.from(keys);
      try {
        const storage = await getStorage(backendId);
        for (let i = 0; i < list.length; i += 1000) {
          const batch = list.slice(i, i + 1000);
          await storage.deleteObjects(batch);
          stats.deletedObjects += batch.length;
        }
      } catch (e) {
        // Un backend injoignable ne doit pas bloquer la suppression en base :
        // sinon l'utilisateur voit un fichier qu'il croit supprimé revenir.
        // On journalise pour pouvoir repasser derrière.
        stats.storageErrors += list.length;
        console.error(
          `[purge-files] Échec suppression stockage backend=${backendId} file=${file.id} objets=${list.length}`,
          e instanceof Error ? e.message : e,
        );
      }
    }

    // 5. Quota : sur un espace d'équipe c'est le propriétaire de l'équipe
    //    qui paie, pas celui qui supprime.
    let quotaUserId: string | undefined = file.teamId
      ? (await db.team.findUnique({ where: { id: file.teamId }, select: { ownerId: true } }))?.ownerId
      : file.ownerId;
    if (!quotaUserId) quotaUserId = fallbackQuotaUserId;

    await db.$transaction([
      // La suppression de File emporte ses FileVersion par cascade.
      db.file.delete({ where: { id: file.id } }),
      ...(quotaUserId
        ? [
            db.user.update({
              where: { id: quotaUserId },
              data: { storageUsed: { decrement: file.size } },
            }),
          ]
        : []),
      ...(otherRefs === 0
        ? [
            db.storageBackend.update({
              where: { id: file.storageBackendId },
              data: { usedBytes: { decrement: file.size } },
            }),
          ]
        : []),
    ]);

    stats.deletedFiles++;
  }

  return stats;
}

/** Champs à sélectionner pour obtenir un PurgeableFile. */
export const PURGEABLE_SELECT = {
  id: true,
  storageKey: true,
  thumbnailKey: true,
  storageBackendId: true,
  size: true,
  ownerId: true,
  teamId: true,
} as const;
