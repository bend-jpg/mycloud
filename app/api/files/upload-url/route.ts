import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getDefaultStorage, userFileKey, teamFileKey } from "@/lib/storage";
import { getMembership, canWrite } from "@/lib/teams";

const schema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
  mimeType: z.string().max(255),
  folderId: z.string().nullable().optional(),
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
  const { name, size, mimeType, folderId, teamId } = parsed.data;

  // Détermination du propriétaire du quota :
  // - Espace perso : le user lui-même
  // - Espace team : l'owner du team (celui qui paye)
  let quotaUserId = session.id;

  if (teamId) {
    const m = await getMembership(teamId, session.id);
    if (!m) return NextResponse.json({ error: "TEAM_FORBIDDEN" }, { status: 403 });
    if (!canWrite(m.role)) {
      return NextResponse.json({ error: "READ_ONLY" }, { status: 403 });
    }
    quotaUserId = m.team.ownerId;
  }

  // Quota check sur le bon user
  const quotaUser = await db.user.findUnique({
    where: { id: quotaUserId },
    select: { storageUsed: true, storageQuota: true },
  });
  if (!quotaUser) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  if (quotaUser.storageUsed + BigInt(size) > quotaUser.storageQuota) {
    return NextResponse.json({ error: "QUOTA_EXCEEDED" }, { status: 413 });
  }

  // Vérif dossier (si fourni, scope perso ou team)
  if (folderId) {
    const folder = await db.folder.findFirst({
      where: { id: folderId, teamId: teamId ?? null, ...(teamId ? {} : { ownerId: session.id }) },
    });
    if (!folder) return NextResponse.json({ error: "FOLDER_NOT_FOUND" }, { status: 404 });
  }

  const fileId = nanoid();
  const { provider, backendId } = await getDefaultStorage();
  const key = teamId ? teamFileKey(teamId, fileId, name) : userFileKey(session.id, fileId, name);

  const presigned = await provider.createPresignedUpload(key, { contentType: mimeType, contentLength: size });

  await db.file.create({
    data: {
      id: fileId,
      name,
      ownerId: session.id,
      teamId: teamId ?? null,
      folderId: folderId ?? null,
      storageBackendId: backendId,
      storageKey: key,
      size: BigInt(size),
      mimeType,
    },
  });

  return NextResponse.json({
    fileId,
    uploadUrl: presigned.url,
    method: presigned.method,
    headers: presigned.headers ?? {},
    key,
  });
}
