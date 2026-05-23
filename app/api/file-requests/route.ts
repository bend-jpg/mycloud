// GET  /api/file-requests       → liste les liens de demande de fichier du user
// POST /api/file-requests       → crée un nouveau lien
//   body : { title, message?, folderId?, maxFiles?, maxFileSizeBytes?, expiresAt?, password? }

import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

const schema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().max(2000).optional(),
  folderId: z.string().nullable().optional(),
  maxFiles: z.number().int().positive().max(1000).optional(),
  maxFileSizeBytes: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  password: z.string().min(4).optional(),
});

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const items = await db.fileRequest.findMany({
      where: { ownerId: session.id, revokedAt: null },
      orderBy: { createdAt: "desc" },
      include: { folder: { select: { id: true, name: true } } },
    });
    return NextResponse.json({
      items: items.map((r) => ({
        id: r.id,
        token: r.token,
        title: r.title,
        message: r.message,
        folderId: r.folderId,
        folderName: r.folder?.name ?? null,
        maxFiles: r.maxFiles,
        maxFileSizeBytes: r.maxFileSizeBytes.toString(),
        expiresAt: r.expiresAt?.toISOString() ?? null,
        hasPassword: !!r.passwordHash,
        uploadCount: r.uploadCount,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }
  const { title, message, folderId, maxFiles, maxFileSizeBytes, expiresAt, password } = parsed.data;

  // Si folderId fourni, vérifie qu'il appartient au user
  if (folderId) {
    const folder = await db.folder.findFirst({
      where: { id: folderId, ownerId: session.id },
      select: { id: true },
    });
    if (!folder) return NextResponse.json({ error: "FOLDER_NOT_FOUND" }, { status: 404 });
  }

  try {
    const created = await db.fileRequest.create({
      data: {
        token: nanoid(16),
        ownerId: session.id,
        folderId: folderId ?? null,
        title,
        message: message ?? null,
        maxFiles: maxFiles ?? 20,
        maxFileSizeBytes: maxFileSizeBytes ? BigInt(maxFileSizeBytes) : BigInt(5 * 1024 * 1024 * 1024),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        passwordHash: password ? await bcrypt.hash(password, 10) : null,
      },
    });
    return NextResponse.json({
      ok: true,
      id: created.id,
      token: created.token,
      url: `${new URL(req.url).origin}/r/${created.token}`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "CREATE_FAILED",
        message: err instanceof Error ? err.message : "Erreur",
      },
      { status: 500 },
    );
  }
}
