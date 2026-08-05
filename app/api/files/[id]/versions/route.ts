// GET  /api/files/[id]/versions       → liste les versions d'un fichier
// POST /api/files/[id]/versions       → restaure une version : body { versionId }

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { hoursUntilVersionPurge } from "@/lib/file-versions";
import { loadAuthorizedFile, accessStatus } from "@/lib/file-access";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await ctx.params;

  // Contrôle d'accès en LECTURE, identique au reste de l'application.
  //
  // Auparavant la route exigeait d'être PROPRIÉTAIRE du fichier. Sur un
  // espace partagé, un membre autorisé à lire ne pouvait donc même pas
  // consulter l'historique d'un fichier qu'il a le droit d'ouvrir.
  const access = await loadAuthorizedFile(id, session.id, "read");
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: accessStatus(access.error) });
  }

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

  // Contrôle d'accès en ÉCRITURE : restaurer une version modifie le fichier
  // pour tout le monde, c'est donc une écriture, pas une lecture.
  //
  // La route exigeait auparavant d'être PROPRIÉTAIRE du fichier, ce qui
  // ouvrait un trou et en fermait un autre :
  //
  //   • Un membre rétrogradé en lecture seule, mais qui avait déposé le
  //     fichier à l'origine, restait propriétaire — il pouvait donc encore
  //     restaurer une version et modifier le fichier de tout le monde,
  //     contournant la restriction.
  //   • À l'inverse, un membre explicitement autorisé à écrire ne pouvait
  //     PAS restaurer, alors qu'il pouvait écraser le contenu par une
  //     modification directe. Incohérent.
  //
  // loadAuthorizedFile applique la même règle que partout ailleurs : sur un
  // espace partagé, c'est le RÔLE qui décide, pas l'historique de dépôt.
  const [access, version] = await Promise.all([
    loadAuthorizedFile(id, session.id, "write"),
    db.fileVersion.findFirst({ where: { id: versionId, fileId: id } }).catch(() => null),
  ]);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: accessStatus(access.error) });
  }
  if (!version) return NextResponse.json({ error: "VERSION_NOT_FOUND" }, { status: 404 });

  const { file } = access;

  // Quota : restaurer une version d'une AUTRE taille change l'espace occupé.
  // Ce n'était pas répercuté — restaurer une version de 10 Mo par-dessus une
  // de 2 Mo laissait le compteur à 2 Mo, définitivement faux, et l'écart
  // s'accumulait à chaque restauration.
  const delta = version.size - file.size;
  const quotaUserId = file.teamId
    ? (await db.team.findUnique({ where: { id: file.teamId }, select: { ownerId: true } }))?.ownerId ??
      file.ownerId
    : file.ownerId;

  // On refuse seulement si la restauration fait GROSSIR au-delà du quota.
  // Revenir à une version plus petite doit toujours être possible, même sur
  // un compte déjà saturé — c'est justement un moyen de se dépanner.
  if (delta > BigInt(0)) {
    const u = await db.user.findUnique({
      where: { id: quotaUserId },
      select: { storageUsed: true, storageQuota: true },
    });
    if (u && u.storageUsed + delta > u.storageQuota) {
      return NextResponse.json({ error: "QUOTA_EXCEEDED" }, { status: 413 });
    }
  }

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
      // 4. Répercute l'écart de taille sur le quota du compte concerné.
      db.user.update({
        where: { id: quotaUserId },
        data: { storageUsed: { increment: delta } },
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
