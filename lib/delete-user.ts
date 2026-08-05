// Suppression COMPLÈTE d'un utilisateur : base de données ET objets stockés.
//
// Avant, la suppression se contentait de `db.user.delete()`. Les lignes en
// base disparaissaient en cascade, mais les fichiers restaient indéfiniment
// dans R2 :
//   - on paie du stockage pour des clients partis,
//   - et le droit à l'effacement (RGPD art. 17) n'est pas satisfait, puisque
//     les données personnelles subsistent chez l'hébergeur.
//
// Subtilité importante : le partage familial crée plusieurs lignes File qui
// pointent vers la MÊME clé de stockage. Supprimer aveuglément les objets
// d'un utilisateur casserait donc les fichiers encore visibles chez les
// autres membres. On compte les références avant de supprimer.

import { db } from "./db";
import { getStorage } from "./storage";

export interface DeleteUserResult {
  deletedObjects: number;
  keptSharedObjects: number;
  storageErrors: number;
}

/**
 * Supprime un utilisateur, ses lignes en base (par cascade Prisma) et les
 * objets de stockage qui lui sont propres.
 *
 * Les objets encore référencés par un fichier appartenant à quelqu'un
 * d'autre sont conservés.
 */
export async function deleteUserCompletely(userId: string): Promise<DeleteUserResult> {
  // 1. Tous les objets rattachés à cet utilisateur : fichiers courants…
  const files = await db.file.findMany({
    where: { ownerId: userId },
    select: { storageKey: true, storageBackendId: true },
  });
  // …et toutes les versions archivées de ces fichiers.
  const versions = await db.fileVersion.findMany({
    where: { file: { ownerId: userId } },
    select: { storageKey: true, storageBackendId: true },
  });

  const candidates = [...files, ...versions];

  // 2. Comptage de références : une clé encore utilisée par le fichier de
  //    quelqu'un d'autre (partage familial) ne doit PAS être supprimée.
  const keys = Array.from(new Set(candidates.map((c) => c.storageKey)));
  let sharedKeys = new Set<string>();
  if (keys.length > 0) {
    const externalRefs = await db.file.findMany({
      where: { storageKey: { in: keys }, ownerId: { not: userId } },
      select: { storageKey: true },
    });
    sharedKeys = new Set(externalRefs.map((r) => r.storageKey));
  }

  // 3. Regroupe par backend de stockage (un compte peut avoir des fichiers
  //    répartis sur plusieurs backends).
  const byBackend = new Map<string, Set<string>>();
  let keptSharedObjects = 0;
  for (const c of candidates) {
    if (sharedKeys.has(c.storageKey)) {
      keptSharedObjects++;
      continue;
    }
    const set = byBackend.get(c.storageBackendId) ?? new Set<string>();
    set.add(c.storageKey);
    byBackend.set(c.storageBackendId, set);
  }

  // 4. Suppression des objets, par lots de 1000 (limite de l'API S3).
  let deletedObjects = 0;
  let storageErrors = 0;
  for (const [backendId, keySet] of byBackend) {
    const list = Array.from(keySet);
    try {
      const storage = await getStorage(backendId);
      for (let i = 0; i < list.length; i += 1000) {
        const batch = list.slice(i, i + 1000);
        await storage.deleteObjects(batch);
        deletedObjects += batch.length;
      }
    } catch (e) {
      // Un backend injoignable ne doit pas empêcher la suppression du
      // compte — sinon l'utilisateur reste bloqué en base. On journalise
      // pour pouvoir repasser derrière.
      storageErrors += list.length;
      console.error(
        `[delete-user] Échec suppression stockage backend=${backendId} user=${userId} objets=${list.length}`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  // 5. Suppression en base — les cascades Prisma emportent fichiers,
  //    dossiers, partages, sessions, notifications, etc.
  await db.user.delete({ where: { id: userId } });

  return { deletedObjects, keptSharedObjects, storageErrors };
}
