// Conservation des versions précédentes d'un fichier.
//
// ─────────────────────────────────────────────────────────────────────────
// LA RÈGLE
// ─────────────────────────────────────────────────────────────────────────
//
//   • On garde UNE seule version précédente : l'avant-dernière.
//     Enregistrer trois fois de suite ne conserve pas trois historiques —
//     seul l'état juste avant le dernier enregistrement reste récupérable.
//
//   • Cette version est conservée 72 heures, puis supprimée définitivement.
//
// Raison : une ancienne version ne sert qu'à rattraper une erreur, et une
// erreur se constate dans les heures qui suivent. Passé ce délai on paie du
// stockage pour des octets que personne ne redemandera jamais.
//
// ─────────────────────────────────────────────────────────────────────────
// LE PIÈGE QUI AURAIT DÉTRUIT DES FICHIERS
// ─────────────────────────────────────────────────────────────────────────
//
// Chaque enregistrement crée DEUX lignes FileVersion : une pour l'ancien
// contenu, une pour le nouveau (marquée courante). À l'enregistrement
// suivant, l'ancienne ligne « courante » est simplement démarquée — mais
// elle CONTINUE de pointer vers la clé de stockage vivante, celle du fichier
// actuel.
//
// Une purge naïve qui supprimerait « toutes les versions non courantes »
// effacerait donc l'objet du fichier ACTUEL. Le fichier existerait encore en
// base, mais son contenu serait introuvable.
//
// D'où la distinction stricte ci-dessous entre :
//   – doublon obsolète : ligne non courante pointant vers la clé VIVE.
//     On supprime la LIGNE, jamais l'objet.
//   – archive réelle : ligne non courante pointant vers une autre clé.
//     Celle-là contient de vrais octets récupérables.
//
// Et un dernier garde-fou : aucun objet n'est supprimé s'il est encore
// référencé par un fichier ou par une version conservée.

import { db } from "./db";
import { getStorage } from "./storage";

/** Durée de conservation d'une version précédente, en heures. */
export const VERSION_RETENTION_HOURS = 72;

/** Nombre de versions précédentes conservées par fichier. */
export const MAX_ARCHIVED_VERSIONS = 1;

const RETENTION_MS = VERSION_RETENTION_HOURS * 60 * 60 * 1000;

export interface VersionRow {
  id: string;
  storageKey: string;
  storageBackendId: string;
  isCurrent: boolean;
  uploadedAt: Date;
  supersededAt: Date | null;
}

/**
 * Date de référence pour la rétention.
 *
 * supersededAt d'abord : c'est le moment où la version a cessé d'être
 * courante, donc où elle est devenue un point de secours. uploadedAt en
 * repli pour les lignes créées avant l'ajout du champ.
 */
export function retentionAnchor(v: { supersededAt: Date | null; uploadedAt: Date }): Date {
  return v.supersededAt ?? v.uploadedAt;
}

export function isExpired(v: { supersededAt: Date | null; uploadedAt: Date }, now: Date = new Date()): boolean {
  return now.getTime() - retentionAnchor(v).getTime() >= RETENTION_MS;
}

/** Heures restantes avant suppression définitive, 0 si échue. */
export function hoursUntilVersionPurge(
  v: { supersededAt: Date | null; uploadedAt: Date },
  now: Date = new Date(),
): number {
  const remaining = RETENTION_MS - (now.getTime() - retentionAnchor(v).getTime());
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / (60 * 60 * 1000));
}

export interface VersionPlan {
  /** Lignes à supprimer sans toucher au stockage (doublons obsolètes). */
  rowsOnly: string[];
  /** Lignes à supprimer AVEC leur objet de stockage. */
  withObjects: VersionRow[];
  /** Version précédente conservée, s'il en reste une. */
  kept: VersionRow | null;
}

/**
 * Décide quoi supprimer pour un fichier donné. Fonction PURE : aucune
 * écriture, aucun accès base — ce qui la rend testable exhaustivement, ce
 * qui compte pour du code qui détruit des données.
 *
 * @param liveKey clé de stockage actuelle du fichier (File.storageKey)
 */
export function planVersionCleanup(
  versions: VersionRow[],
  liveKey: string,
  now: Date = new Date(),
): VersionPlan {
  const rowsOnly: string[] = [];
  const archives: VersionRow[] = [];

  for (const v of versions) {
    // La version courante n'est jamais touchée : c'est le fichier lui-même.
    if (v.isCurrent) continue;
    // Doublon obsolète : pointe vers la clé vivante. La ligne ne sert à rien,
    // mais l'objet est celui du fichier actuel — on ne le touche JAMAIS.
    if (v.storageKey === liveKey) {
      rowsOnly.push(v.id);
      continue;
    }
    archives.push(v);
  }

  // La plus récente d'abord.
  archives.sort((a, b) => retentionAnchor(b).getTime() - retentionAnchor(a).getTime());

  const withObjects: VersionRow[] = [];
  let kept: VersionRow | null = null;

  for (let i = 0; i < archives.length; i++) {
    const v = archives[i];
    const overLimit = i >= MAX_ARCHIVED_VERSIONS;
    if (overLimit || isExpired(v, now)) {
      withObjects.push(v);
    } else if (!kept) {
      kept = v;
    }
  }

  return { rowsOnly, withObjects, kept };
}

export interface CleanupStats {
  deletedRows: number;
  deletedObjects: number;
  keptSharedObjects: number;
  storageErrors: number;
}

/**
 * Applique le nettoyage des versions d'un fichier.
 *
 * Appelée après chaque enregistrement (pour faire respecter la limite d'une
 * version) et par la maintenance nocturne (pour l'expiration à 72 h).
 */
export async function cleanupFileVersions(fileId: string, now: Date = new Date()): Promise<CleanupStats> {
  const stats: CleanupStats = { deletedRows: 0, deletedObjects: 0, keptSharedObjects: 0, storageErrors: 0 };

  const file = await db.file.findUnique({
    where: { id: fileId },
    select: { storageKey: true },
  });
  // Fichier supprimé entre-temps : ses versions partent par cascade, rien à
  // faire ici. Surtout, sans clé vivante on ne peut plus distinguer un
  // doublon d'une archive — donc on s'abstient plutôt que de deviner.
  if (!file) return stats;

  const versions = await db.fileVersion.findMany({
    where: { fileId },
    select: {
      id: true,
      storageKey: true,
      storageBackendId: true,
      isCurrent: true,
      uploadedAt: true,
      supersededAt: true,
    },
  });

  const plan = planVersionCleanup(versions, file.storageKey, now);

  // 1. Doublons obsolètes : la ligne seulement.
  if (plan.rowsOnly.length > 0) {
    await db.fileVersion.deleteMany({ where: { id: { in: plan.rowsOnly } } });
    stats.deletedRows += plan.rowsOnly.length;
  }

  // 2. Archives échues ou en trop : ligne + objet, après vérification qu'aucun
  //    fichier et aucune version conservée ne référence encore la clé.
  for (const v of plan.withObjects) {
    const doomedIds = plan.withObjects.map((x) => x.id);

    const [fileRefs, versionRefs] = await Promise.all([
      db.file.count({ where: { storageKey: v.storageKey, storageBackendId: v.storageBackendId } }),
      db.fileVersion.count({
        where: {
          storageKey: v.storageKey,
          storageBackendId: v.storageBackendId,
          id: { notIn: doomedIds },
        },
      }),
    ]);

    if (fileRefs === 0 && versionRefs === 0) {
      try {
        const storage = await getStorage(v.storageBackendId);
        await storage.deleteObject(v.storageKey);
        stats.deletedObjects++;
      } catch (e) {
        // Un stockage injoignable ne doit pas empêcher le nettoyage en base :
        // la ligne partira, l'objet sera repris par un passage ultérieur.
        stats.storageErrors++;
        console.error(
          `[file-versions] Échec suppression objet ${v.storageKey}`,
          e instanceof Error ? e.message : e,
        );
      }
    } else {
      stats.keptSharedObjects++;
    }

    await db.fileVersion.delete({ where: { id: v.id } }).catch(() => {});
    stats.deletedRows++;
  }

  return stats;
}
