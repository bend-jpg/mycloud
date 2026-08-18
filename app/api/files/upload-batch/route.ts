// POST /api/files/upload-batch — prépare l'envoi de PLUSIEURS fichiers d'un coup.
//
// ─────────────────────────────────────────────────────────────────────────
// POURQUOI CETTE ROUTE EXISTE
// ─────────────────────────────────────────────────────────────────────────
//
// L'import d'un dossier de site web représente typiquement des dizaines de
// milliers de petits fichiers. Constaté en production : 83 802 fichiers pour
// 3,94 Go, soit 47 Ko en moyenne.
//
// Avec une requête de préparation PAR fichier, ce n'est plus la bande
// passante qui limite mais le nombre d'allers-retours : 83 802 appels de
// fonction serveur, chacun avec son démarrage, sa connexion à la base et son
// écriture. Mesuré chez l'utilisateur : 37 Ko/s et plus de 25 heures
// annoncées, pour des octets qui passeraient en moins d'une heure.
//
// Ici, un seul appel prépare jusqu'à 100 fichiers : une vérification de
// quota, une vérification de dossiers, une écriture groupée en base. Le
// nombre d'allers-terours est divisé par cent.
//
// L'ancienne route reste en place : elle sert encore pour un fichier isolé,
// et un import déjà lancé dans un onglet ouvert continue de fonctionner.

import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getDefaultStorage, userFileKey, teamFileKey } from "@/lib/storage";
import { getMembership, canWrite } from "@/lib/teams";

export const runtime = "nodejs";

// 100 par lot : au-delà, la signature des URL et l'écriture groupée
// commencent à approcher le temps maximum d'une fonction serveur, et un lot
// qui expire fait repartir 100 fichiers au lieu d'un.
const MAX_BATCH = 100;

const schema = z.object({
  files: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        size: z.number().int().nonnegative(),
        mimeType: z.string().max(255),
        folderId: z.string().nullable().optional(),
      }),
    )
    .min(1)
    .max(MAX_BATCH),
  teamId: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }
  const { files, teamId } = parsed.data;

  // Le quota est celui du propriétaire de l'équipe sur un espace partagé.
  let quotaUserId = session.id;
  if (teamId) {
    const m = await getMembership(teamId, session.id);
    if (!m) return NextResponse.json({ error: "TEAM_FORBIDDEN" }, { status: 403 });
    if (!canWrite(m.role)) return NextResponse.json({ error: "READ_ONLY" }, { status: 403 });
    quotaUserId = m.team.ownerId;
  }

  const quotaUser = await db.user.findUnique({
    where: { id: quotaUserId },
    select: { storageUsed: true, storageQuota: true, plan: { select: { maxUploadSizeBytes: true } } },
  });
  if (!quotaUser) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

  // Limite par fichier : un seul fichier trop gros ne doit pas faire échouer
  // les 99 autres, on le signale individuellement.
  const maxPerFile = quotaUser.plan?.maxUploadSizeBytes ?? BigInt(5 * 1024 * 1024 * 1024);
  const rejected: { index: number; error: string }[] = [];
  const accepted: typeof files = [];
  files.forEach((f, index) => {
    if (BigInt(f.size) > maxPerFile) rejected.push({ index, error: "FILE_TOO_LARGE" });
    else accepted.push(f);
  });

  // Quota vérifié sur le TOTAL du lot, en une seule lecture.
  const totalBytes = accepted.reduce((s, f) => s + BigInt(f.size), BigInt(0));
  if (quotaUser.storageUsed + totalBytes > quotaUser.storageQuota) {
    return NextResponse.json({ error: "QUOTA_EXCEEDED" }, { status: 413 });
  }

  // Dossiers : une seule requête pour l'ensemble des destinations distinctes,
  // au lieu d'une par fichier.
  const folderIds = Array.from(new Set(accepted.map((f) => f.folderId).filter(Boolean))) as string[];
  if (folderIds.length > 0) {
    const found = await db.folder.findMany({
      where: {
        id: { in: folderIds },
        teamId: teamId ?? null,
        ...(teamId ? {} : { ownerId: session.id }),
      },
      select: { id: true },
    });
    const ok = new Set(found.map((f) => f.id));
    for (const id of folderIds) {
      if (!ok.has(id)) return NextResponse.json({ error: "FOLDER_NOT_FOUND", folderId: id }, { status: 404 });
    }
  }

  const { provider, backendId } = await getDefaultStorage();

  // Signature des URL en parallèle : c'est du calcul local, sans appel
  // réseau — les enchaîner ne servirait qu'à perdre du temps.
  const prepared = await Promise.all(
    accepted.map(async (f) => {
      const fileId = nanoid();
      const key = teamId ? teamFileKey(teamId, fileId, f.name) : userFileKey(session.id, fileId, f.name);
      const presigned = await provider.createPresignedUpload(key, {
        contentType: f.mimeType,
        contentLength: f.size,
      });
      return {
        fileId,
        key,
        uploadUrl: presigned.url,
        method: presigned.method,
        headers: presigned.headers ?? {},
        row: {
          id: fileId,
          name: f.name,
          ownerId: session.id,
          teamId: teamId ?? null,
          folderId: f.folderId ?? null,
          storageBackendId: backendId,
          storageKey: key,
          size: BigInt(f.size),
          mimeType: f.mimeType,
          // Invisible tant que les octets ne sont pas confirmés : un envoi
          // interrompu ne doit pas laisser de fichier impossible à ouvrir.
          uploadPending: true,
        },
      };
    }),
  );

  // UNE seule écriture pour tout le lot.
  await db.file.createMany({ data: prepared.map((p) => p.row) });

  return NextResponse.json({
    files: prepared.map((p) => ({
      fileId: p.fileId,
      uploadUrl: p.uploadUrl,
      method: p.method,
      headers: p.headers,
      key: p.key,
    })),
    rejected,
  });
}
