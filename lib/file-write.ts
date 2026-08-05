// Remplacement du contenu d'un fichier existant, avec historique et quota.
//
// Cette logique vivait uniquement dans /api/files/[id]/content (édition de
// texte). L'ajout de l'édition de tableurs et d'autres formats la rendait
// nécessaire à plusieurs endroits — la dupliquer aurait été le meilleur
// moyen de corriger un bug à un seul endroit sur trois.
//
// Trois pièges sont traités ici, et c'est pour ça que personne ne devrait
// réécrire un objet de stockage sans passer par cette fonction :
//
//   1. L'ancienne version DOIT être copiée sous une nouvelle clé AVANT
//      l'écrasement. Sinon la ligne FileVersion pointe vers des octets
//      détruits et l'historique est un mensonge.
//   2. Le quota se calcule sur le DELTA, pas sur la taille du nouveau
//      contenu — sinon un fichier qui rétrécit continue de consommer.
//   3. Sur un espace d'équipe, le quota est celui du PROPRIÉTAIRE de
//      l'équipe, pas de celui qui édite.

import { db } from "./db";
import { getStorage } from "./storage";
import { cleanupFileVersions } from "./file-versions";

export interface WritableFile {
  id: string;
  size: bigint;
  mimeType: string;
  ownerId: string;
  teamId: string | null;
  storageKey: string;
  storageBackendId: string;
}

export type ReplaceResult =
  | { ok: true; size: number }
  | { ok: false; error: "QUOTA_EXCEEDED" };

/**
 * Écrase le contenu d'un fichier par `buf`, archive l'ancienne version et
 * ajuste le quota du compte concerné.
 *
 * @param contentType type MIME à écrire ; par défaut celui du fichier.
 */
export async function replaceFileContent(
  file: WritableFile,
  buf: Buffer,
  editorUserId: string,
  contentType?: string,
): Promise<ReplaceResult> {
  const oldSize = Number(file.size);
  const delta = BigInt(buf.length - oldSize);

  // Sur un espace d'équipe, c'est le propriétaire de l'équipe qui paie.
  const quotaUserId = file.teamId
    ? (await db.team.findUnique({ where: { id: file.teamId }, select: { ownerId: true } }))?.ownerId ??
      file.ownerId
    : file.ownerId;

  // On ne bloque que si le fichier GROSSIT : un enregistrement qui réduit la
  // taille doit toujours passer, même sur un compte déjà au-dessus du quota.
  if (delta > BigInt(0)) {
    const u = await db.user.findUnique({
      where: { id: quotaUserId },
      select: { storageUsed: true, storageQuota: true },
    });
    if (u && u.storageUsed + delta > u.storageQuota) {
      return { ok: false, error: "QUOTA_EXCEEDED" };
    }
  }

  const storage = await getStorage(file.storageBackendId);

  // Archive l'ancienne version SOUS UNE NOUVELLE CLÉ avant tout écrasement.
  const versionKey = `${file.storageKey}.v${Date.now()}`;
  try {
    await storage.copyObject(file.storageKey, versionKey);
  } catch {
    // Backend sans copie côté serveur : relecture puis réécriture.
    const old = await storage.getObject(file.storageKey);
    await storage.putObject(versionKey, old);
  }

  await storage.putObject(file.storageKey, buf, { contentType: contentType ?? file.mimeType });

  const now = new Date();

  await db.$transaction([
    db.fileVersion.updateMany({
      where: { fileId: file.id, isCurrent: true },
      // supersededAt marque le moment où la version cesse d'être courante :
      // c'est de là que part son délai de conservation.
      data: { isCurrent: false, supersededAt: now },
    }),
    db.fileVersion.create({
      data: {
        fileId: file.id,
        storageBackendId: file.storageBackendId,
        storageKey: versionKey,
        size: BigInt(oldSize),
        uploadedById: editorUserId,
        isCurrent: false,
        // Créée déjà archivée : son compteur démarre maintenant.
        supersededAt: now,
      },
    }),
    db.fileVersion.create({
      data: {
        fileId: file.id,
        storageBackendId: file.storageBackendId,
        storageKey: file.storageKey,
        size: BigInt(buf.length),
        uploadedById: editorUserId,
        isCurrent: true,
      },
    }),
    db.file.update({
      where: { id: file.id },
      data: { size: BigInt(buf.length), updatedAt: new Date() },
    }),
    db.user.update({
      where: { id: quotaUserId },
      data: { storageUsed: { increment: delta } },
    }),
  ]);

  // Applique immédiatement la règle « une seule version précédente » : sans
  // ça, enregistrer dix fois laisserait dix copies dans le bucket en
  // attendant la maintenance nocturne. Le nettoyage ne doit jamais faire
  // échouer l'enregistrement lui-même — le contenu est déjà écrit et la
  // maintenance repassera.
  try {
    await cleanupFileVersions(file.id, now);
  } catch (e) {
    console.error("[file-write] Nettoyage des versions échoué", e instanceof Error ? e.message : e);
  }

  return { ok: true, size: buf.length };
}
