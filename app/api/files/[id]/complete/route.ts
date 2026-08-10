// /api/files/[id]/complete — finalisation d'un upload.
//
// Flux normal :
//  1. Vérifie que les bytes sont bien dans le storage
//  2. Met à jour la vraie taille du fichier
//  3. Incrémente le quota du payeur (user ou owner du team)
//  4. Crée une notification quota si seuil franchi
//  5. Log d'activité team si pertinent
//
// Versioning (depuis Round 85) :
//  6. Cherche si un autre fichier porte le même nom dans le même dossier
//     du même propriétaire (= duplicate). Si oui :
//     - Snapshot des bytes du fichier existant ("head") dans une FileVersion
//     - Met à jour le head pour pointer vers les nouveaux bytes
//     - Supprime la ligne File du nouvel upload (head est canonique)
//     → L'utilisateur garde un historique navigable via /api/files/[id]/versions

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { getMembership, canWrite } from "@/lib/teams";
import { checkQuotaAlert } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;

  // `uploadPending: undefined` = « peu importe l'état ».
  //
  // C'EST INDISPENSABLE ICI. Le client Prisma masque automatiquement les
  // fichiers dont les octets ne sont pas confirmés (voir lib/db.ts), pour
  // qu'un envoi interrompu ne laisse pas un fichier fantôme dans les listes.
  // Mais cette route est précisément celle qui CONFIRME les octets : sans
  // cette échappatoire, elle ne retrouve jamais le fichier qu'elle doit
  // finaliser et tous les envois échouent avec « Échec de la finalisation ».
  //
  // Mentionner le champ, même à undefined, suffit à désactiver le filtre.
  const file = await db.file.findFirst({
    where: { id, ownerId: session.id, uploadPending: undefined },
  });
  if (!file) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Vérification d'autorisation supplémentaire pour les fichiers de team
  let quotaUserId = file.ownerId;
  if (file.teamId) {
    const m = await getMembership(file.teamId, session.id);
    if (!m || !canWrite(m.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    quotaUserId = m.team.ownerId;
  }

  // Vérifie que l'objet existe bien dans le storage avant de marquer comme finalisé
  const storage = await getStorage(file.storageBackendId);
  const headObj = await storage.headObject(file.storageKey);
  if (!headObj) {
    await db.file.delete({ where: { id } });
    return NextResponse.json({ error: "UPLOAD_NOT_FOUND" }, { status: 404 });
  }

  // Met à jour la taille réelle puis compte le fichier dans le quota du payeur
  const realSize = BigInt(headObj.size);
  await db.$transaction([
    // Les octets sont confirmés présents (headObject ci-dessus) : le fichier
    // devient visible.
    db.file.update({ where: { id }, data: { size: realSize, uploadPending: false } }),
    db.user.update({
      where: { id: quotaUserId },
      data: { storageUsed: { increment: realSize } },
    }),
    db.storageBackend.update({
      where: { id: file.storageBackendId },
      data: { usedBytes: { increment: realSize } },
    }),
  ]);

  // ============================================================
  // VERSIONING : si un autre fichier porte déjà ce nom dans ce dossier,
  // on merge — l'ancien devient une FileVersion, le head pointe sur les
  // nouveaux bytes.
  // ============================================================
  let resultFileId = file.id;
  let resultName = file.name;
  let merged = false;

  try {
    const existing = await db.file.findFirst({
      where: {
        ownerId: file.ownerId,
        teamId: file.teamId,
        folderId: file.folderId,
        name: file.name,
        isTrash: false,
        id: { not: file.id },
      },
      orderBy: { uploadedAt: "asc" },
    });

    if (existing) {
      // existing = head (le plus ancien, canonique). file = le nouvel upload.
      // 1. Snapshot de l'état actuel du head dans FileVersion (marqué pas current)
      // 2. Marque toutes ses versions précédentes comme pas current
      // 3. Update head pour pointer sur les nouveaux bytes (file.storageKey, etc.)
      // 4. Crée une FileVersion pour le nouvel état (marqué current)
      // 5. Supprime file (les bytes restent, référencés par head)
      await db.$transaction([
        db.fileVersion.updateMany({
          where: { fileId: existing.id, isCurrent: true },
          // Départ du délai de conservation de 72 h.
          data: { isCurrent: false, supersededAt: new Date() },
        }),
        db.fileVersion.create({
          data: {
            fileId: existing.id,
            storageBackendId: existing.storageBackendId,
            storageKey: existing.storageKey,
            size: existing.size,
            checksum: existing.checksum,
            uploadedById: existing.ownerId,
            isCurrent: false,
            supersededAt: new Date(),
          },
        }),
        db.fileVersion.create({
          data: {
            fileId: existing.id,
            storageBackendId: file.storageBackendId,
            storageKey: file.storageKey,
            size: realSize,
            checksum: file.checksum,
            uploadedById: session.id,
            isCurrent: true,
          },
        }),
        db.file.update({
          where: { id: existing.id },
          data: {
            storageBackendId: file.storageBackendId,
            storageKey: file.storageKey,
            size: realSize,
            mimeType: file.mimeType,
            checksum: file.checksum,
            updatedAt: new Date(),
          },
        }),
        db.file.delete({ where: { id: file.id } }),
      ]);

      resultFileId = existing.id;
      resultName = existing.name;
      merged = true;
    }
  } catch {
    // Si la table FileVersion n'existe pas (defensive — schema pas pushé),
    // on continue sans versioning. Pas de crash.
  }

  // Notification quota si seuil franchi (80%, 95%, 100%)
  await checkQuotaAlert(quotaUserId).catch(() => undefined);

  // Trace dans l'activity log si fichier team
  if (file.teamId) {
    await logActivity({
      userId: session.id,
      teamId: file.teamId,
      action: merged ? "team.file.version" : "team.file.upload",
      metadata: { fileName: resultName, size: realSize.toString() },
    });
  }

  return NextResponse.json({
    ok: true,
    file: { id: resultFileId, name: resultName, size: realSize.toString() },
    merged,
  });
}
