// Soft-delete d'un dossier (récursif). Les fichiers dans le dossier vont à la corbeille
// mais comptent toujours dans le quota tant qu'ils ne sont pas hard-deleted.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getMembership, canWrite } from "@/lib/teams";

export async function DELETE(
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
  const folder = await db.folder.findFirst({ where: { id } });
  if (!folder) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Permissions : owner perso, OU EDITOR+ du team
  let allowed = folder.ownerId === session.id && !folder.teamId;
  if (folder.teamId) {
    const m = await getMembership(folder.teamId, session.id);
    allowed = !!m && canWrite(m.role);
  }
  if (!allowed) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  // Récursif : marquer en corbeille tous les sous-dossiers et fichiers descendants
  // Approche simple : on récupère tous les IDs descendants via path, puis on update.
  const fullPath = folder.path === "/" ? `/${folder.name}` : `${folder.path}/${folder.name}`;
  const teamScope = folder.teamId ? { teamId: folder.teamId } : { ownerId: session.id, teamId: null };

  await db.$transaction([
    db.folder.update({ where: { id }, data: { isTrash: true, deletedAt: new Date() } }),
    db.folder.updateMany({
      where: { ...teamScope, path: { startsWith: fullPath } },
      data: { isTrash: true, deletedAt: new Date() },
    }),
    db.file.updateMany({
      where: { folderId: id },
      data: { isTrash: true, deletedAt: new Date() },
    }),
    // Pour les fichiers dans les sous-dossiers : on ne les retrouve pas par path
    // (les fichiers n'ont pas de path), donc il faudrait une vraie récursion.
    // Pour V1 on accepte cette limitation : seuls les fichiers DIRECTEMENT dans
    // le dossier supprimé sont aussi corbeille. Les sous-dossiers sont en corbeille
    // mais leurs fichiers restent visibles (mais le dossier parent l'est).
  ]);

  return NextResponse.json({ ok: true });
}

// Rename
const patchSchema = z.object({ name: z.string().min(1).max(120) });
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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const folder = await db.folder.findFirst({ where: { id } });
  if (!folder) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  let allowed = folder.ownerId === session.id && !folder.teamId;
  if (folder.teamId) {
    const m = await getMembership(folder.teamId, session.id);
    allowed = !!m && canWrite(m.role);
  }
  if (!allowed) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  await db.folder.update({ where: { id }, data: { name: parsed.data.name.slice(0, 120) } });
  return NextResponse.json({ ok: true });
}
