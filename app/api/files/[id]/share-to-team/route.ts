// Partage un fichier perso vers un team famille (l'original reste en perso).
// Crée une nouvelle File row avec le MÊME storageKey → pas de duplication
// physique sur R2, juste 2 références DB sur la même donnée.
// La suppression vérifie le ref count avant de toucher R2.

import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getMembership, canWrite } from "@/lib/teams";

const schema = z.object({
  teamId: z.string().min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const file = await db.file.findFirst({ where: { id, isTrash: false } });
  if (!file) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (file.ownerId !== session.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const m = await getMembership(parsed.data.teamId, session.id);
  if (!m || !canWrite(m.role)) {
    return NextResponse.json({ error: "TEAM_FORBIDDEN" }, { status: 403 });
  }

  // Existe-t-il déjà une copie dans ce team ?
  const existing = await db.file.findFirst({
    where: { storageKey: file.storageKey, teamId: parsed.data.teamId, isTrash: false },
  });
  if (existing) {
    return NextResponse.json({ error: "ALREADY_SHARED", message: "Déjà partagé dans ce team." }, { status: 409 });
  }

  // Crée une référence dans le team (même storageKey, pas de re-upload sur R2)
  const teamOwnerId = m.team.ownerId;
  const teamOwner = await db.user.findUnique({
    where: { id: teamOwnerId },
    select: { storageUsed: true, storageQuota: true },
  });
  // Si le team owner est différent de l'user et qu'il n'a pas la place, on refuse
  if (teamOwner && teamOwnerId !== file.ownerId && teamOwner.storageUsed + file.size > teamOwner.storageQuota) {
    return NextResponse.json({ error: "TARGET_QUOTA_EXCEEDED" }, { status: 413 });
  }

  await db.$transaction([
    db.file.create({
      data: {
        id: nanoid(),
        name: file.name,
        ownerId: file.ownerId,
        teamId: parsed.data.teamId,
        folderId: null,
        storageBackendId: file.storageBackendId,
        storageKey: file.storageKey, // ← référence partagée vers le même blob
        size: file.size,
        mimeType: file.mimeType,
      },
    }),
    // Le team owner "paie" le quota (si différent de l'uploader)
    ...(teamOwnerId !== file.ownerId
      ? [db.user.update({ where: { id: teamOwnerId }, data: { storageUsed: { increment: file.size } } })]
      : []),
  ]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Retire le partage : supprime la copie dans le team (mais garde l'original perso).
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const url = new URL(req.url);
  const teamId = url.searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ error: "MISSING_TEAM" }, { status: 400 });

  const original = await db.file.findFirst({ where: { id } });
  if (!original) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (original.ownerId !== session.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const sharedCopy = await db.file.findFirst({
    where: { storageKey: original.storageKey, teamId, ownerId: session.id },
  });
  if (!sharedCopy) return NextResponse.json({ ok: true });

  const team = await db.team.findUnique({ where: { id: teamId }, select: { ownerId: true } });
  const decrementOwnerId = team && team.ownerId !== original.ownerId ? team.ownerId : null;

  await db.$transaction([
    db.file.delete({ where: { id: sharedCopy.id } }),
    ...(decrementOwnerId
      ? [db.user.update({ where: { id: decrementOwnerId }, data: { storageUsed: { decrement: original.size } } })]
      : []),
  ]);

  return NextResponse.json({ ok: true });
}
