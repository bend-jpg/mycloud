// POST /api/files/complete-batch — confirme l'envoi de PLUSIEURS fichiers.
//
// Pendant : /api/files/upload-batch. Voir la note qui s'y trouve pour la
// raison d'être des lots — en résumé, un import de dossier représente des
// dizaines de milliers de petits fichiers, et c'est le nombre d'allers-retours
// qui limite, pas la bande passante.
//
// ─────────────────────────────────────────────────────────────────────────
// DEUX PRÉCAUTIONS
// ─────────────────────────────────────────────────────────────────────────
//
// 1. `uploadPending: undefined` est OBLIGATOIRE à la lecture. Le client
//    Prisma masque par défaut les fichiers non confirmés (lib/db-filters.ts),
//    et cette route est justement celle qui les confirme : sans cette
//    échappatoire elle ne trouve jamais rien, et tous les envois échouent.
//    C'est exactement le défaut qui a bloqué tous les imports auparavant.
//
// 2. Le versionnement (un fichier du même nom existe déjà dans le dossier →
//    l'ancien devient une version) n'est PAS refait ici. Le reproduire en
//    masse dupliquerait une logique délicate. Ces fichiers sont renvoyés dans
//    `needsMerge` et le navigateur les finalise un par un via l'ancienne
//    route. Le cas est rare sur un import ; le chemin rapide couvre le reste.

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { getMembership, canWrite } from "@/lib/teams";

export const runtime = "nodejs";

const MAX_BATCH = 100;

const schema = z.object({ fileIds: z.array(z.string()).min(1).max(MAX_BATCH) });

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  // uploadPending: undefined → « peu importe l'état ». Voir la note 1.
  const files = await db.file.findMany({
    where: { id: { in: parsed.data.fileIds }, ownerId: session.id, uploadPending: undefined },
    select: {
      id: true,
      name: true,
      folderId: true,
      teamId: true,
      storageKey: true,
      storageBackendId: true,
      ownerId: true,
    },
  });
  if (files.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Droit d'écriture sur l'espace partagé : vérifié une fois par équipe
  // concernée, pas une fois par fichier.
  const teamIds = Array.from(new Set(files.map((f) => f.teamId).filter(Boolean))) as string[];
  const teamOwner = new Map<string, string>();
  for (const teamId of teamIds) {
    const m = await getMembership(teamId, session.id);
    if (!m || !canWrite(m.role)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    teamOwner.set(teamId, m.team.ownerId);
  }

  // Un fichier dont le nom existe déjà dans le même dossier doit passer par
  // le versionnement : renvoyé au navigateur pour finalisation individuelle.
  const conflicts = await db.file.findMany({
    where: {
      ownerId: session.id,
      id: { notIn: files.map((f) => f.id) },
      OR: files.map((f) => ({ name: f.name, folderId: f.folderId, teamId: f.teamId })),
    },
    select: { name: true, folderId: true, teamId: true },
  });
  const conflictKey = new Set(conflicts.map((c) => `${c.teamId ?? ""}|${c.folderId ?? ""}|${c.name}`));

  const fast = files.filter((f) => !conflictKey.has(`${f.teamId ?? ""}|${f.folderId ?? ""}|${f.name}`));
  const needsMerge = files
    .filter((f) => conflictKey.has(`${f.teamId ?? ""}|${f.folderId ?? ""}|${f.name}`))
    .map((f) => f.id);

  // Vérification de présence des octets, en parallèle : ce sont des requêtes
  // réseau indépendantes, les enchaîner multiplierait la durée par cent.
  const backendIds = Array.from(new Set(fast.map((f) => f.storageBackendId)));
  const storages = new Map(await Promise.all(backendIds.map(async (id) => [id, await getStorage(id)] as const)));

  const checked = await Promise.all(
    fast.map(async (f) => {
      try {
        const head = await storages.get(f.storageBackendId)!.headObject(f.storageKey);
        return head ? { file: f, size: BigInt(head.size) } : { file: f, size: null };
      } catch {
        return { file: f, size: null };
      }
    }),
  );

  const confirmed = checked.filter((c) => c.size !== null) as { file: (typeof fast)[number]; size: bigint }[];
  const missing = checked.filter((c) => c.size === null).map((c) => c.file.id);

  // Les octets manquants signifient un envoi qui n'a pas abouti : la ligne
  // n'a plus de raison d'exister, et la laisser recréerait un fichier
  // fantôme.
  if (missing.length > 0) {
    await db.file.deleteMany({ where: { id: { in: missing } } });
  }

  if (confirmed.length > 0) {
    // Les incréments de quota sont agrégés PAR compte payeur : cent
    // écritures sur la même ligne utilisateur se bloqueraient mutuellement.
    const perUser = new Map<string, bigint>();
    const perBackend = new Map<string, bigint>();
    for (const { file, size } of confirmed) {
      const payer = file.teamId ? teamOwner.get(file.teamId) ?? file.ownerId : file.ownerId;
      perUser.set(payer, (perUser.get(payer) ?? BigInt(0)) + size);
      perBackend.set(file.storageBackendId, (perBackend.get(file.storageBackendId) ?? BigInt(0)) + size);
    }

    await db.$transaction([
      ...confirmed.map(({ file, size }) =>
        db.file.update({ where: { id: file.id }, data: { size, uploadPending: false } }),
      ),
      ...Array.from(perUser, ([userId, bytes]) =>
        db.user.update({ where: { id: userId }, data: { storageUsed: { increment: bytes } } }),
      ),
      ...Array.from(perBackend, ([backendId, bytes]) =>
        db.storageBackend.update({ where: { id: backendId }, data: { usedBytes: { increment: bytes } } }),
      ),
    ]);
  }

  return NextResponse.json({
    ok: true,
    completed: confirmed.map((c) => c.file.id),
    missing,
    needsMerge,
  });
}
