// POST /api/me/avatar — upload de la photo de profil de l'utilisateur.
// DELETE /api/me/avatar — supprime l'avatar (revient à l'initiale).
//
// L'avatar est stocké comme un fichier normal dans le storage backend
// par défaut, sous une clé spéciale "avatars/<userId>.<ext>". L'URL
// renvoyée est utilisée comme user.image en DB.

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getDefaultStorage } from "@/lib/storage";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const file = formData.get("avatar");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "FILE_MISSING" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "INVALID_TYPE", message: "JPG, PNG, WebP ou GIF uniquement" },
      { status: 400 },
    );
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return NextResponse.json(
      { error: "FILE_TOO_LARGE", message: "Maximum 5 Mo" },
      { status: 413 },
    );
  }

  const { provider, backendId: _backendId } = await getDefaultStorage();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg";
  // Clé unique avec nanoid pour éviter le caching navigateur de l'ancien avatar
  const key = `avatars/${session.id}-${nanoid(8)}.${ext}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await provider.putObject(key, buffer, {
      contentType: file.type,
      contentLength: file.size,
    });

    // URL publique via la presigned download
    const presigned = await provider.createPresignedDownload(key, undefined, 365 * 24 * 60 * 60);

    await db.user.update({
      where: { id: session.id },
      data: { image: presigned.url },
    });

    return NextResponse.json({ ok: true, image: presigned.url });
  } catch (err) {
    return NextResponse.json(
      { error: "UPLOAD_FAILED", message: err instanceof Error ? err.message : "Erreur" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  await db.user.update({ where: { id: session.id }, data: { image: null } });
  return NextResponse.json({ ok: true });
}
