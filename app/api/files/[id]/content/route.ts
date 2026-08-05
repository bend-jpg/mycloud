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
import { isTextEditable } from "@/lib/file-kinds";
import { replaceFileContent } from "@/lib/file-write";

// 5 Mo de texte : au-delà, l'édition en ligne n'a plus de sens (et le
// navigateur rame). Les fichiers plus gros restent téléchargeables.
const MAX_EDITABLE_BYTES = 5 * 1024 * 1024;

// La détection vivait ici, en double avec celle de la modale d'aperçu, et
// les deux acceptaient tout type MIME contenant « xml » — ce qui incluait
// les fichiers Office (application/vnd.openXMLformats-…). Ouvrir un .xlsx
// lançait donc l'éditeur de texte, et enregistrer détruisait le fichier.
// Voir lib/file-kinds.ts.

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

  // Archivage de l'ancienne version, quota, historique et application de la
  // règle de conservation : tout est dans replaceFileContent. Cette route en
  // avait sa propre copie, identique à celle de l'édition de tableurs — deux
  // copies d'un mécanisme aussi délicat finissent toujours par diverger.
  const result = await replaceFileContent(file, buf, session.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 413 });

  return NextResponse.json({ ok: true, size: result.size });
}
