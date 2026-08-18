// Soft-delete d'un dossier (récursif). Les fichiers dans le dossier vont à la corbeille
// mais comptent toujours dans le quota tant qu'ils ne sont pas hard-deleted.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { collectFolderSubtree } from "@/lib/folder-tree";
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

  // Toute l'arborescence part à la corbeille : le dossier, ses sous-dossiers,
  // ET tous les fichiers qu'ils contiennent.
  //
  // La version précédente ne prenait que les fichiers placés DIRECTEMENT dans
  // le dossier supprimé. Ceux des sous-dossiers restaient : ils continuaient
  // d'occuper le quota tout en devenant inatteignables, leur dossier parent
  // étant à la corbeille. Vu de l'utilisateur, la suppression ne marchait
  // tout simplement pas.
  const folderIds = await collectFolderSubtree([id], {
    teamId: folder.teamId,
    ownerId: session.id,
  });
  const now = new Date();

  const [folders, files] = await db.$transaction([
    db.folder.updateMany({
      where: { id: { in: folderIds } },
      data: { isTrash: true, deletedAt: now },
    }),
    db.file.updateMany({
      where: { folderId: { in: folderIds }, isTrash: false },
      data: { isTrash: true, deletedAt: now },
    }),
  ]);

  return NextResponse.json({ ok: true, folders: folders.count, files: files.count });
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
