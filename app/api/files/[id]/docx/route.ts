// GET/PUT /api/files/[id]/docx — lecture ET modification d'un document Word
// directement dans le cloud.
//
// ─────────────────────────────────────────────────────────────────────────
// CE QUI EST CONSERVÉ, ET CE QUI NE L'EST PAS
// ─────────────────────────────────────────────────────────────────────────
//
// Un .docx est une archive XML décrivant une mise en page complète. On sait
// le convertir en HTML lisible, et reconstruire un .docx valide à partir de
// cet HTML — mais pas à l'identique.
//
// Conservé  : le texte, les titres, le gras, l'italique, les listes, les
//             tableaux, les liens, les accents et l'hébreu.
// Perdu     : le souligné et le barré (le convertisseur ne les gère pas),
//             les polices et tailles d'origine, les couleurs, les marges et
//             sections, les en-têtes et pieds de page, les images, les notes
//             de bas de page, les styles nommés, le suivi des modifications.
//
// Ces limites ne sont pas supposées : elles sont vérifiées par les tests
// d'aller-retour (tests/unit/docx-roundtrip.test.ts). C'est d'ailleurs un
// test qui a révélé que l'italique disparaissait silencieusement.
//
// L'utilisateur est prévenu AVANT d'enregistrer, et l'ancienne version reste
// récupérable pendant 72 h (voir lib/file-versions.ts). Pour une fidélité
// totale il faut une suite bureautique dédiée sur un serveur à elle.
//
// ─────────────────────────────────────────────────────────────────────────
// L'HTML EST TRAITÉ COMME HOSTILE DANS LES DEUX SENS
// ─────────────────────────────────────────────────────────────────────────
//
// À la lecture, le document peut venir d'un tiers via un partage. À
// l'écriture, l'HTML arrive du navigateur et peut avoir été fabriqué. Il est
// donc nettoyé à l'aller ET au retour — un nettoyage côté navigateur ne
// prouve rien, il suffit d'appeler l'API directement pour le contourner.

import { NextResponse } from "next/server";
import mammoth from "mammoth";
import HTMLtoDOCX from "html-to-docx";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { loadAuthorizedFile, accessStatus } from "@/lib/file-access";
import { isWordDocument, DOCX_MIME } from "@/lib/file-kinds";
import { replaceFileContent } from "@/lib/file-write";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { normalizeForDocx } from "@/lib/docx-html";

export const runtime = "nodejs";

const MAX_DOC_BYTES = 10 * 1024 * 1024;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const res = await loadAuthorizedFile(id, session.id, "read");
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: accessStatus(res.error) });
  const { file } = res;

  if (!isWordDocument(file.mimeType, file.name)) {
    return NextResponse.json({ error: "NOT_WORD_DOCUMENT" }, { status: 415 });
  }
  if (Number(file.size) > MAX_DOC_BYTES) {
    return NextResponse.json({ error: "TOO_LARGE", maxBytes: MAX_DOC_BYTES }, { status: 413 });
  }

  const storage = await getStorage(file.storageBackendId);
  const buf = await storage.getObject(file.storageKey);

  let html: string;
  try {
    const result = await mammoth.convertToHtml({ buffer: Buffer.from(buf) });
    html = sanitizeHtml(result.value);
  } catch {
    // Document protégé par mot de passe, corrompu, ou ancien format .doc
    // (mammoth ne lit que le .docx moderne).
    return NextResponse.json({ error: "UNREADABLE" }, { status: 422 });
  }

  return NextResponse.json({
    name: file.name,
    html,
    readOnly: false,
  });
}

// 2 Mo d'HTML : très au-delà d'un document raisonnable, mais borné pour
// qu'une requête fabriquée ne fasse pas exploser la mémoire de la fonction.
const putSchema = z.object({ html: z.string().max(2 * 1024 * 1024) });

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const res = await loadAuthorizedFile(id, session.id, "write");
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: accessStatus(res.error) });
  const { file } = res;

  if (!isWordDocument(file.mimeType, file.name)) {
    return NextResponse.json({ error: "NOT_WORD_DOCUMENT" }, { status: 415 });
  }

  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  // Nettoyage AVANT conversion. L'HTML vient du navigateur : le nettoyage
  // qui y a été fait ne prouve rien, il suffit d'appeler cette route
  // directement pour le contourner.
  const clean = sanitizeHtml(parsed.data.html);

  let out: Buffer;
  try {
    const produced = await HTMLtoDOCX(normalizeForDocx(clean), null, { table: { row: { cantSplit: true } } });
    out = Buffer.isBuffer(produced) ? produced : Buffer.from(await (produced as Blob).arrayBuffer());
  } catch (e) {
    console.error("[docx] Conversion échouée", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "CONVERSION_FAILED" }, { status: 422 });
  }

  // Garde-fou : un .docx est une archive ZIP, elle commence par « PK ». Si
  // la conversion produisait autre chose, on écrirait un fichier corrompu
  // par-dessus le document de l'utilisateur.
  if (out.length < 1000 || out[0] !== 0x50 || out[1] !== 0x4b) {
    return NextResponse.json({ error: "CONVERSION_FAILED" }, { status: 422 });
  }

  const result = await replaceFileContent(file, out, session.id, DOCX_MIME);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 413 });

  return NextResponse.json({ ok: true, size: result.size });
}
