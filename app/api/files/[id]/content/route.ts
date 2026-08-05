// GET/PUT /api/files/[id]/content — lecture et ÉDITION en ligne du contenu
// texte d'un fichier (code, HTML, CSV, JSON, markdown…).
//
// Permet de modifier un fichier directement depuis l'aperçu sans passer par
// télécharger → éditer → réuploader. À chaque enregistrement, l'ancienne
// version est archivée dans FileVersion (historique restaurable), la nouvelle
// devient la version courante, et le quota est ajusté du delta de taille.

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { getMembership, canRead, canWrite } from "@/lib/teams";

// 5 Mo de texte : au-delà, l'édition en ligne n'a plus de sens (et le
// navigateur rame). Les fichiers plus gros restent téléchargeables.
const MAX_EDITABLE_BYTES = 5 * 1024 * 1024;

/** Types considérés comme éditables en texte brut. */
function isTextEditable(mimeType: string, name: string): boolean {
  if (mimeType.startsWith("text/")) return true;
  if (/(json|xml|javascript|typescript|x-sh|x-httpd-php|yaml|csv|sql|markdown)/i.test(mimeType)) return true;
  // Certains fichiers arrivent en application/octet-stream : on se rabat sur
  // l'extension, qui reste le signal le plus fiable côté navigateur.
  return /\.(txt|md|markdown|csv|tsv|json|jsonc|xml|ya?ml|toml|ini|cfg|conf|env|log|sql|html?|css|scss|less|js|mjs|cjs|jsx|ts|tsx|php|py|rb|go|rs|java|kt|c|h|cpp|hpp|cs|sh|bash|zsh|ps1|bat|dockerfile|gitignore|svg)$/i.test(
    name,
  );
}

/** Charge le fichier + vérifie que l'appelant a le droit demandé. */
async function loadAuthorized(id: string, userId: string, need: "read" | "write") {
  const file = await db.file.findUnique({
    where: { id },
    select: {
      id: true, name: true, size: true, mimeType: true, ownerId: true, teamId: true,
      storageKey: true, storageBackendId: true, isTrash: true,
    },
  });
  if (!file || file.isTrash) return { error: "NOT_FOUND" as const };

  if (file.teamId) {
    const m = await getMembership(file.teamId, userId);
    if (!m) return { error: "FORBIDDEN" as const };
    if (need === "read" ? !canRead(m.role) : !canWrite(m.role)) return { error: "FORBIDDEN" as const };
  } else if (file.ownerId !== userId) {
    return { error: "FORBIDDEN" as const };
  }
  return { file };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  const res = await loadAuthorized(id, session.id, "read");
  if ("error" in res) {
    return NextResponse.json({ error: res.error }, { status: res.error === "NOT_FOUND" ? 404 : 403 });
  }
  const { file } = res;

  if (!isTextEditable(file.mimeType, file.name)) {
    return NextResponse.json({ error: "NOT_TEXT" }, { status: 415 });
  }
  if (Number(file.size) > MAX_EDITABLE_BYTES) {
    return NextResponse.json({ error: "TOO_LARGE", maxBytes: MAX_EDITABLE_BYTES }, { status: 413 });
  }

  const storage = await getStorage(file.storageBackendId);
  const buf = await storage.getObject(file.storageKey);
  return NextResponse.json({
    name: file.name,
    mimeType: file.mimeType,
    // toString("utf8") : les fichiers non-UTF8 auront des caractères de
    // remplacement — acceptable, on ne propose l'édition que sur du texte.
    content: Buffer.from(buf).toString("utf8"),
    editable: true,
  });
}

const putSchema = z.object({ content: z.string().max(MAX_EDITABLE_BYTES) });

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  const res = await loadAuthorized(id, session.id, "write");
  if ("error" in res) {
    return NextResponse.json({ error: res.error }, { status: res.error === "NOT_FOUND" ? 404 : 403 });
  }
  const { file } = res;

  if (!isTextEditable(file.mimeType, file.name)) {
    return NextResponse.json({ error: "NOT_TEXT" }, { status: 415 });
  }

  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const buf = Buffer.from(parsed.data.content, "utf8");
  const oldSize = Number(file.size);
  const delta = BigInt(buf.length - oldSize);

  // Quota : on ne bloque que si le fichier GROSSIT et dépasse la limite
  const quotaUserId = file.teamId
    ? (await db.team.findUnique({ where: { id: file.teamId }, select: { ownerId: true } }))?.ownerId ?? file.ownerId
    : file.ownerId;
  if (delta > BigInt(0)) {
    const u = await db.user.findUnique({
      where: { id: quotaUserId },
      select: { storageUsed: true, storageQuota: true },
    });
    if (u && u.storageUsed + delta > u.storageQuota) {
      return NextResponse.json({ error: "QUOTA_EXCEEDED" }, { status: 413 });
    }
  }

  // Archive l'ancienne version SOUS UNE NOUVELLE CLÉ (sinon l'écrasement
  // détruirait les bytes que la version est censée pointer).
  const storage = await getStorage(file.storageBackendId);
  const versionKey = `${file.storageKey}.v${Date.now()}`;
  try {
    await storage.copyObject(file.storageKey, versionKey);
  } catch {
    // Backend sans copie serveur : on relit puis on réécrit
    const old = await storage.getObject(file.storageKey);
    await storage.putObject(versionKey, old);
  }

  // Écrit le nouveau contenu à la clé courante
  await storage.putObject(file.storageKey, buf, { contentType: file.mimeType });

  await db.$transaction([
    db.fileVersion.updateMany({ where: { fileId: file.id, isCurrent: true }, data: { isCurrent: false } }),
    db.fileVersion.create({
      data: {
        fileId: file.id,
        storageBackendId: file.storageBackendId,
        storageKey: versionKey,
        size: BigInt(oldSize),
        uploadedById: session.id,
        isCurrent: false,
      },
    }),
    db.fileVersion.create({
      data: {
        fileId: file.id,
        storageBackendId: file.storageBackendId,
        storageKey: file.storageKey,
        size: BigInt(buf.length),
        uploadedById: session.id,
        isCurrent: true,
      },
    }),
    db.file.update({ where: { id: file.id }, data: { size: BigInt(buf.length), updatedAt: new Date() } }),
    db.user.update({ where: { id: quotaUserId }, data: { storageUsed: { increment: delta } } }),
  ]);

  return NextResponse.json({ ok: true, size: buf.length });
}
