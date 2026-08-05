import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getMembership, canWrite } from "@/lib/teams";
import { logActivity } from "@/lib/activity";
import { hardDeleteFiles, PURGEABLE_SELECT } from "@/lib/purge-files";

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
    // Le comptage de références (partage familial), la suppression des
    // objets, la miniature, les versions archivées et l'ajustement du quota
    // sont regroupés dans lib/purge-files.ts. Cette route avait sa propre
    // version, qui oubliait la miniature et les versions : elles restaient
    // dans le bucket, facturées, sans plus rien pour les référencer.
    const full = await db.file.findUnique({ where: { id }, select: PURGEABLE_SELECT });
    if (full) await hardDeleteFiles([full], await quotaUserIdForFile(file));
  } else {
    await db.file.update({ where: { id }, data: { isTrash: true, deletedAt: new Date() } });
  }

  // Trace si team
  if (file.teamId) {
    await logActivity({
      userId: session.id,
      teamId: file.teamId,
      action: "team.file.delete",
      metadata: { fileName: file.name, hard },
    });
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
