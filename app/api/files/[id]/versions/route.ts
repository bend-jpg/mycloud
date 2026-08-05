// GET  /api/files/[id]/versions       → liste les versions d'un fichier
// POST /api/files/[id]/versions       → restaure une version : body { versionId }

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { hoursUntilVersionPurge } from "@/lib/file-versions";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await ctx.params;

  // Vérifie que le fichier appartient à l'utilisateur
  const file = await db.file.findFirst({
    where: { id, ownerId: session.id },
    select: { id: true },
  });
  if (!file) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Defensive si la table FileVersion pas encore pushée
  try {
    const versions = await db.fileVersion.findMany({
      where: { fileId: id },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        size: true,
        checksum: true,
        uploadedAt: true,
        uploadedById: true,
        isCurrent: true,
        supersededAt: true,
      },
    });
    return NextResponse.json({
      versions: versions.map((v) => ({
        id: v.id,
        size: v.size.toString(),
        checksum: v.checksum,
        uploadedAt: v.uploadedAt.toISOString(),
        uploadedById: v.uploadedById,
        isCurrent: v.isCurrent,
        // Heures restantes avant suppression définitive : l'interface doit
        // pouvoir prévenir AVANT que la version disparaisse.
        hoursLeft: v.isCurrent ? null : hoursUntilVersionPurge(v),
      })),
    });
  } catch {
    return NextResponse.json({ versions: [] });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { versionId } = body as { versionId?: string };
  if (!versionId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  // Vérifie ownership + version existe + appartient bien à ce fichier
  const [file, version] = await Promise.all([
    db.file.findFirst({ where: { id, ownerId: session.id } }),
    db.fileVersion.findFirst({ where: { id: versionId, fileId: id } }).catch(() => null),
  ]);
  if (!file) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!version) return NextResponse.json({ error: "VERSION_NOT_FOUND" }, { status: 404 });

  try {
    // Transaction : on bascule isCurrent + on met à jour le File pour pointer
    // sur les bytes de cette version
    await db.$transaction([
      // 1. Marque toutes les versions comme non-current.
      //    supersededAt est remis à maintenant : la version qu'on vient de
      //    quitter redevient le point de secours, son délai de conservation
      //    doit donc repartir de zéro. Sans ça, restaurer une vieille version
      //    ferait disparaître aussitôt le travail abandonné, sans retour
      //    possible.
      db.fileVersion.updateMany({
        where: { fileId: id, isCurrent: true },
        data: { isCurrent: false, supersededAt: new Date() },
      }),
      // 2. Marque cette version comme current
      db.fileVersion.update({
        where: { id: versionId },
        // Redevenue courante : elle n'est plus soumise à la rétention.
        data: { isCurrent: true, supersededAt: null },
      }),
      // 3. Met à jour le File pour pointer sur les bytes de cette version
      db.file.update({
        where: { id },
        data: {
          storageKey: version.storageKey,
          storageBackendId: version.storageBackendId,
          size: version.size,
          checksum: version.checksum,
          updatedAt: new Date(),
        },
      }),
    ]);
    return NextResponse.json({ ok: true, restored: versionId });
  } catch (err) {
    return NextResponse.json(
      {
        error: "RESTORE_FAILED",
        message: err instanceof Error ? err.message : "Erreur",
      },
      { status: 500 },
    );
  }
}
