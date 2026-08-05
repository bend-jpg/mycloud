// Aperçu inline d'un fichier (sans forcer le téléchargement).
// Utilisé pour les thumbnails dans la grille et le modal de preview.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { getMembership, canRead } from "@/lib/teams";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const file = await db.file.findFirst({ where: { id, isTrash: false } });
  if (!file) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Accès : owner du fichier OU membre du team avec rôle lecture
  let allowed = file.ownerId === session.id;
  if (!allowed && file.teamId) {
    const m = await getMembership(file.teamId, session.id);
    allowed = !!m && canRead(m.role);
  }
  // Admin peut tout voir (pour la page /admin/clients/[id]/files)
  if (!allowed && session.isAdmin) allowed = true;
  if (!allowed) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const storage = await getStorage(file.storageBackendId);

  // Types actifs : le navigateur les EXÉCUTE (scripts, gestionnaires
  // d'événements). Les servir en inline revient à héberger du contenu
  // arbitraire exécutable sur notre domaine de stockage — utilisable pour
  // de l'hameçonnage ou de la distribution de malware sous notre nom.
  //
  // L'impact reste limité car l'aperçu redirige vers R2 : le script
  // s'exécute sur l'origine du stockage, pas sur celle de l'application,
  // et ne peut donc pas voler la session d'un utilisateur. On force
  // malgré tout le téléchargement pour ces types — aucun d'eux n'a besoin
  // d'être affiché en inline (les images, vidéos, audio et PDF le restent).
  const ACTIVE_TYPES = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|application\/xml|text\/xml)/i;
  const forceDownload = ACTIVE_TYPES.test(file.mimeType);

  // Passer un fileName déclenche Content-Disposition: attachment côté S3/R2.
  const presigned = await storage.createPresignedDownload(
    file.storageKey,
    forceDownload ? file.name : undefined,
    3600,
  );

  // Cache 1h côté navigateur pour limiter les re-fetch des thumbnails (immutable
  // pendant la durée du signed URL R2). private = pas mis en cache CDN partagé.
  return NextResponse.redirect(presigned.url, {
    status: 302,
    headers: {
      "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
