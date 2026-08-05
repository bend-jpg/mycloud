// PUT /api/files/[id]/thumbnail — enregistre la vignette d'une image.
//
// Le champ `thumbnailKey` existait dans le schéma mais n'était alimenté
// nulle part : la grille de fichiers et la galerie photos affichaient donc
// l'image PLEINE RÉSOLUTION dans des cases de 200 px. Avec des photos de
// téléphone (~2 Mo pièce), une galerie de 500 images faisait télécharger
// près d'un gigaoctet à chaque ouverture de page — inutilisable en mobile.
//
// La vignette est produite par le NAVIGATEUR (canvas) juste après l'upload,
// puis envoyée ici. Aucun traitement d'image côté serveur : pas de
// dépendance native, pas de dépassement mémoire sur une fonction
// serverless, et le coût reste nul.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { getMembership, canWrite } from "@/lib/teams";

// Une vignette légitime pèse quelques dizaines de Ko. Au-delà, on refuse :
// ça signifie que le client n'a pas redimensionné.
const MAX_THUMB_BYTES = 400 * 1024;

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const file = await db.file.findUnique({
    where: { id },
    select: {
      id: true, ownerId: true, teamId: true, mimeType: true,
      storageKey: true, storageBackendId: true, thumbnailKey: true, isTrash: true,
    },
  });
  if (!file || file.isTrash) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Mêmes règles d'écriture que pour le fichier lui-même
  if (file.teamId) {
    const m = await getMembership(file.teamId, session.id);
    if (!m || !canWrite(m.role)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  } else if (file.ownerId !== session.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // Une vignette n'a de sens que pour une image
  if (!file.mimeType.startsWith("image/")) {
    return NextResponse.json({ error: "NOT_AN_IMAGE" }, { status: 415 });
  }

  const body = Buffer.from(await req.arrayBuffer());
  if (body.length === 0) return NextResponse.json({ error: "EMPTY" }, { status: 400 });
  if (body.length > MAX_THUMB_BYTES) {
    return NextResponse.json({ error: "THUMB_TOO_LARGE" }, { status: 413 });
  }

  // Clé dérivée de celle du fichier : la suppression du compte la ramasse
  // automatiquement (lib/delete-user parcourt les clés des fichiers).
  const thumbKey = `${file.storageKey}.thumb.jpg`;
  const storage = await getStorage(file.storageBackendId);
  await storage.putObject(thumbKey, body, { contentType: "image/jpeg" });

  await db.file.update({ where: { id: file.id }, data: { thumbnailKey: thumbKey } });

  // La vignette n'est pas comptée dans le quota : elle est marginale
  // (quelques dizaines de Ko) et c'est un coût de service, pas de l'espace
  // choisi par l'utilisateur.
  return NextResponse.json({ ok: true, bytes: body.length });
}
