// GET /api/files/[id]/docx — affichage d'un document Word dans le cloud.
//
// LECTURE SEULE, et c'est délibéré.
//
// Un .docx est une archive XML décrivant une mise en page complète (styles,
// numérotation, sections, notes, en-têtes). On sait le convertir en HTML
// lisible ; on ne sait PAS reconstruire le .docx d'origine à partir de cet
// HTML sans détruire une partie de la mise en forme. Proposer un bouton
// « enregistrer » ici reviendrait à faire perdre du travail à l'utilisateur
// sans qu'il comprenne pourquoi son document est abîmé.
//
// Pour modifier un Word en conservant sa mise en forme, il faut une suite
// bureautique dédiée (type OnlyOffice) sur un serveur à elle.
//
// L'HTML produit est nettoyé avant envoi : le document vient d'un tiers
// (fichier partagé), donc il est traité comme non fiable.

import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { requireSession } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { loadAuthorizedFile, accessStatus } from "@/lib/file-access";
import { isWordDocument } from "@/lib/file-kinds";
import { sanitizeHtml } from "@/lib/sanitize-html";

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
    readOnly: true,
  });
}
