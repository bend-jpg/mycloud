import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

// Récupère les infos publiques d'un lien (utilisé par la page publique)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const link = await db.shareLink.findUnique({
    where: { token },
    include: { file: { select: { name: true, size: true, mimeType: true } } },
  });
  if (!link || link.revokedAt) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (link.expiresAt && link.expiresAt < new Date()) {
    return NextResponse.json({ error: "EXPIRED" }, { status: 410 });
  }
  if (link.maxDownloads != null && link.downloadCount >= link.maxDownloads) {
    return NextResponse.json({ error: "MAX_DOWNLOADS_REACHED" }, { status: 410 });
  }

  return NextResponse.json({
    kind: link.kind,
    fileName: link.file?.name ?? null,
    fileSize: link.file?.size.toString() ?? null,
    mimeType: link.file?.mimeType ?? null,
    expiresAt: link.expiresAt,
    maxDownloads: link.maxDownloads,
    downloadCount: link.downloadCount,
    hasPassword: !!link.passwordHash,
    customMessage: link.customMessage,
  });
}

// Révoque un lien (créateur uniquement)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { token } = await params;
  const link = await db.shareLink.findUnique({ where: { token } });
  if (!link || link.createdById !== session.id) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  await db.shareLink.update({ where: { token }, data: { revokedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
