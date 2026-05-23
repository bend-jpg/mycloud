// POST /api/file-requests/public/[token]/upload
// Reçoit un fichier d'un destinataire anonyme et le stocke chez l'utilisateur
// qui a créé le file request. multipart/form-data avec "file" + optionnel "password".

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { getDefaultStorage, userFileKey } from "@/lib/storage";

// Tailles maxi par chunk (5 GB par défaut, peut être réduit par le request)
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const request = await db.fileRequest.findUnique({ where: { token } }).catch(() => null);
  if (!request) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (request.revokedAt) return NextResponse.json({ error: "REVOKED" }, { status: 403 });
  if (request.expiresAt && request.expiresAt < new Date()) {
    return NextResponse.json({ error: "EXPIRED" }, { status: 403 });
  }
  if (request.uploadCount >= request.maxFiles) {
    return NextResponse.json({ error: "FULL" }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "FILE_MISSING" }, { status: 400 });
  }
  const password = formData.get("password");

  // Vérif password
  if (request.passwordHash) {
    const ok =
      typeof password === "string" &&
      (await bcrypt.compare(password, request.passwordHash).catch(() => false));
    if (!ok) {
      return NextResponse.json({ error: "WRONG_PASSWORD" }, { status: 401 });
    }
  }

  // Taille fichier
  if (BigInt(file.size) > request.maxFileSizeBytes) {
    return NextResponse.json(
      {
        error: "FILE_TOO_LARGE",
        message: `Max ${Number(request.maxFileSizeBytes) / 1024 / 1024} Mo`,
      },
      { status: 413 },
    );
  }

  // Vérif quota du destinataire
  const owner = await db.user.findUnique({
    where: { id: request.ownerId },
    select: { storageUsed: true, storageQuota: true },
  });
  if (!owner) return NextResponse.json({ error: "OWNER_GONE" }, { status: 404 });
  if (owner.storageUsed + BigInt(file.size) > owner.storageQuota) {
    return NextResponse.json({ error: "OWNER_QUOTA_EXCEEDED" }, { status: 507 });
  }

  // Crée le File + upload bytes
  const fileId = nanoid();
  const { provider, backendId } = await getDefaultStorage();
  const key = userFileKey(request.ownerId, fileId, file.name);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await provider.putObject(key, buffer, {
      contentType: file.type || "application/octet-stream",
      contentLength: file.size,
    });

    await db.$transaction([
      db.file.create({
        data: {
          id: fileId,
          name: file.name,
          ownerId: request.ownerId,
          folderId: request.folderId,
          storageBackendId: backendId,
          storageKey: key,
          size: BigInt(file.size),
          mimeType: file.type || "application/octet-stream",
        },
      }),
      db.user.update({
        where: { id: request.ownerId },
        data: { storageUsed: { increment: BigInt(file.size) } },
      }),
      db.fileRequest.update({
        where: { id: request.id },
        data: { uploadCount: { increment: 1 } },
      }),
    ]);
    return NextResponse.json({ ok: true, fileId });
  } catch (err) {
    return NextResponse.json(
      { error: "UPLOAD_FAILED", message: err instanceof Error ? err.message : "Erreur" },
      { status: 500 },
    );
  }
}
