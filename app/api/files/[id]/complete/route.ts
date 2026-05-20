import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { getMembership, canWrite } from "@/lib/teams";
import { checkQuotaAlert } from "@/lib/notifications";

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
  const file = await db.file.findFirst({ where: { id, ownerId: session.id } });
  if (!file) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Vérification d'autorisation supplémentaire pour les fichiers de team :
  // - L'uploader doit toujours être EDITOR+ sur le team
  let quotaUserId = file.ownerId;
  if (file.teamId) {
    const m = await getMembership(file.teamId, session.id);
    if (!m || !canWrite(m.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    quotaUserId = m.team.ownerId; // quota sur le propriétaire du team (qui paye)
  }

  // Vérifie que l'objet existe bien dans le storage avant de marquer comme finalisé
  const storage = await getStorage(file.storageBackendId);
  const head = await storage.headObject(file.storageKey);
  if (!head) {
    await db.file.delete({ where: { id } });
    return NextResponse.json({ error: "UPLOAD_NOT_FOUND" }, { status: 404 });
  }

  // Met à jour la taille réelle puis compte le fichier dans le quota du payeur
  const realSize = BigInt(head.size);
  await db.$transaction([
    db.file.update({ where: { id }, data: { size: realSize } }),
    db.user.update({
      where: { id: quotaUserId },
      data: { storageUsed: { increment: realSize } },
    }),
    db.storageBackend.update({
      where: { id: file.storageBackendId },
      data: { usedBytes: { increment: realSize } },
    }),
  ]);

  // Notification quota si seuil franchi (80%, 95%, 100%)
  await checkQuotaAlert(quotaUserId).catch(() => undefined);

  return NextResponse.json({ ok: true, file: { id: file.id, name: file.name, size: realSize.toString() } });
}
