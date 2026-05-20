import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getStorage } from "@/lib/storage";

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

  // Vérifie que l'objet existe bien dans le storage avant de marquer comme finalisé
  const storage = await getStorage(file.storageBackendId);
  const head = await storage.headObject(file.storageKey);
  if (!head) {
    await db.file.delete({ where: { id } });
    return NextResponse.json({ error: "UPLOAD_NOT_FOUND" }, { status: 404 });
  }

  // Met à jour la taille réelle puis compte le fichier dans le quota
  // (storageUsed n'inclut que les fichiers finalisés)
  const realSize = BigInt(head.size);
  await db.$transaction([
    db.file.update({ where: { id }, data: { size: realSize } }),
    db.user.update({
      where: { id: session.id },
      data: { storageUsed: { increment: realSize } },
    }),
    db.storageBackend.update({
      where: { id: file.storageBackendId },
      data: { usedBytes: { increment: realSize } },
    }),
  ]);

  return NextResponse.json({ ok: true, file: { id: file.id, name: file.name, size: realSize.toString() } });
}
