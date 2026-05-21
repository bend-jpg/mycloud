import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { rateLimit, rateLimitReset, getClientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity";

// GET sans mot de passe / POST avec mot de passe
async function handle(req: Request, token: string, password: string | null) {
  const link = await db.shareLink.findUnique({
    where: { token },
    include: { file: true },
  });
  if (!link || link.revokedAt) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (link.expiresAt && link.expiresAt < new Date()) {
    return NextResponse.json({ error: "EXPIRED" }, { status: 410 });
  }
  if (link.maxDownloads != null && link.downloadCount >= link.maxDownloads) {
    return NextResponse.json({ error: "MAX_DOWNLOADS_REACHED" }, { status: 410 });
  }

  if (link.passwordHash) {
    if (!password) return NextResponse.json({ error: "PASSWORD_REQUIRED" }, { status: 401 });
    // Anti brute-force : 8 tentatives/15 min par IP+token
    const ip = getClientIp(req);
    const rlKey = `share-pwd:${token}:${ip}`;
    const rl = rateLimit(rlKey, 8, 15 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "TOO_MANY_ATTEMPTS", message: "Trop de tentatives. Réessaie dans 15 min." },
        { status: 429, headers: { "Retry-After": Math.ceil((rl.resetAt - Date.now()) / 1000).toString() } }
      );
    }
    const ok = await bcrypt.compare(password, link.passwordHash);
    if (!ok) return NextResponse.json({ error: "BAD_PASSWORD" }, { status: 401 });
    rateLimitReset(rlKey); // mot de passe bon : on remet à zéro le compteur
  }

  if (link.kind !== "FILE" || !link.file) {
    return NextResponse.json({ error: "UNSUPPORTED" }, { status: 400 });
  }
  const file = link.file;

  // Trace anonymisée
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
  await db.$transaction([
    db.shareDownload.create({
      data: { shareToken: token, ipHash, userAgent: req.headers.get("user-agent") ?? null },
    }),
    db.shareLink.update({ where: { token }, data: { downloadCount: { increment: 1 } } }),
  ]);

  // Trace pour le propriétaire du lien (visible dans son activity log)
  await logActivity({
    userId: link.createdById,
    action: "share.download",
    req,
    metadata: { fileName: file.name, shareToken: token },
  });

  const storage = await getStorage(file.storageBackendId);
  const presigned = await storage.createPresignedDownload(file.storageKey, file.name, 600);
  // 303 See Other → force le client à faire un GET sur l'URL signée même après un POST
  return NextResponse.redirect(presigned.url, 303);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const url = new URL(req.url);
  const password = url.searchParams.get("password");
  return handle(req, token, password);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  let password: string | null = null;
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    password = body.password ?? null;
  } else {
    const form = await req.formData();
    password = (form.get("password") as string | null) ?? null;
  }
  return handle(req, token, password);
}
