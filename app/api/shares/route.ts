import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

const schema = z.object({
  fileId: z.string().min(1),
  password: z.string().min(1).max(120).optional().nullable(),
  expiresInDays: z.number().int().min(1).max(365).optional().nullable(),
  maxDownloads: z.number().int().min(1).max(1000000).optional().nullable(),
  customMessage: z.string().max(500).optional().nullable(),
  notifyOnDownload: z.boolean().optional(),
});

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
  const { fileId, password, expiresInDays, maxDownloads, customMessage, notifyOnDownload } = parsed.data;

  // Vérifie que le fichier appartient à l'utilisateur
  const file = await db.file.findFirst({ where: { id: fileId, ownerId: session.id, isTrash: false } });
  if (!file) return NextResponse.json({ error: "FILE_NOT_FOUND" }, { status: 404 });

  // Limite du plan (maxShareDays)
  const userWithPlan = await db.user.findUnique({
    where: { id: session.id },
    include: { plan: true },
  });
  const planMaxDays = userWithPlan?.plan?.maxShareDays ?? 7;
  const days = Math.min(expiresInDays ?? planMaxDays, planMaxDays);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const token = nanoid(12); // ex : x7Kp2fGq8z3M
  const passwordHash = password ? await bcrypt.hash(password, 10) : null;

  const link = await db.shareLink.create({
    data: {
      token,
      createdById: session.id,
      kind: "FILE",
      fileId: file.id,
      passwordHash,
      expiresAt,
      maxDownloads: maxDownloads ?? null,
      customMessage: customMessage ?? null,
      notifyOnDownload: notifyOnDownload ?? true,
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return NextResponse.json({
    ok: true,
    share: {
      token: link.token,
      url: `${baseUrl}/s/${link.token}`,
      expiresAt: link.expiresAt,
      maxDownloads: link.maxDownloads,
      hasPassword: !!passwordHash,
    },
  });
}

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const links = await db.shareLink.findMany({
    where: { createdById: session.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    include: { file: { select: { name: true, size: true, mimeType: true } } },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return NextResponse.json({
    shares: links.map((l) => ({
      token: l.token,
      url: `${baseUrl}/s/${l.token}`,
      kind: l.kind,
      fileName: l.file?.name ?? null,
      fileSize: l.file?.size.toString() ?? null,
      expiresAt: l.expiresAt,
      maxDownloads: l.maxDownloads,
      downloadCount: l.downloadCount,
      hasPassword: !!l.passwordHash,
      customMessage: l.customMessage,
      createdAt: l.createdAt,
    })),
  });
}
