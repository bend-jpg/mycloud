import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { getMembership, canWrite } from "@/lib/teams";

// Le quota est crédité à l'owner du team (perso = uploader, team = team.ownerId)
async function quotaUserIdForFile(file: { ownerId: string; teamId: string | null }): Promise<string> {
  if (!file.teamId) return file.ownerId;
  const team = await db.team.findUnique({ where: { id: file.teamId }, select: { ownerId: true } });
  return team?.ownerId ?? file.ownerId;
}

// Soft delete (move to trash) — owner OU membre EDITOR+ du team
export async function DELETE(
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
  const url = new URL(req.url);
  const hard = url.searchParams.get("hard") === "1";

  const file = await db.file.findFirst({ where: { id } });
  if (!file) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let allowed = file.ownerId === session.id;
  if (!allowed && file.teamId) {
    const m = await getMembership(file.teamId, session.id);
    allowed = !!m && canWrite(m.role);
  }
  if (!allowed) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  if (hard) {
    // Ref counting : on ne supprime physiquement le blob R2 que si plus aucune autre
    // File row ne référence ce storageKey (cas du "partage famille" qui crée une copie DB
    // avec le même storageKey pour économiser le stockage).
    const otherRefs = await db.file.count({
      where: {
        storageKey: file.storageKey,
        storageBackendId: file.storageBackendId,
        NOT: { id },
      },
    });
    const quotaUserId = await quotaUserIdForFile(file);
    if (otherRefs === 0) {
      const storage = await getStorage(file.storageBackendId);
      await storage.deleteObject(file.storageKey).catch(() => {});
    }
    await db.$transaction([
      db.file.delete({ where: { id } }),
      db.user.update({ where: { id: quotaUserId }, data: { storageUsed: { decrement: file.size } } }),
      ...(otherRefs === 0
        ? [
            db.storageBackend.update({
              where: { id: file.storageBackendId },
              data: { usedBytes: { decrement: file.size } },
            }),
          ]
        : []),
    ]);
  } else {
    await db.file.update({ where: { id }, data: { isTrash: true, deletedAt: new Date() } });
  }
  return NextResponse.json({ ok: true });
}

// Rename — owner OU EDITOR+ du team
export async function PATCH(
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
  if (!body || typeof body.name !== "string" || body.name.length === 0) {
    return NextResponse.json({ error: "INVALID_NAME" }, { status: 400 });
  }
  const file = await db.file.findFirst({ where: { id } });
  if (!file) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let allowed = file.ownerId === session.id;
  if (!allowed && file.teamId) {
    const m = await getMembership(file.teamId, session.id);
    allowed = !!m && canWrite(m.role);
  }
  if (!allowed) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  await db.file.update({ where: { id }, data: { name: body.name.slice(0, 255) } });
  return NextResponse.json({ ok: true });
}
