import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getMembership, canWrite } from "@/lib/teams";

const schema = z.object({
  name: z.string().min(1).max(120),
  parentId: z.string().nullable().optional(),
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
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  const { name, parentId, teamId } = parsed.data;

  if (teamId) {
    const m = await getMembership(teamId, session.id);
    if (!m || !canWrite(m.role)) {
      return NextResponse.json({ error: "READ_ONLY" }, { status: 403 });
    }
  }

  let parentPath = "/";
  if (parentId) {
    const parent = await db.folder.findFirst({
      where: { id: parentId, teamId: teamId ?? null, ...(teamId ? {} : { ownerId: session.id }) },
    });
    if (!parent) return NextResponse.json({ error: "PARENT_NOT_FOUND" }, { status: 404 });
    parentPath = parent.path === "/" ? `/${parent.name}` : `${parent.path}/${parent.name}`;
  }
  const folder = await db.folder.create({
    data: {
      name: name.slice(0, 120),
      ownerId: session.id,
      teamId: teamId ?? null,
      parentId: parentId ?? null,
      path: parentPath,
    },
  });

  return NextResponse.json({ ok: true, folder: { id: folder.id, name: folder.name } });
}
