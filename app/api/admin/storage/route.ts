import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { invalidateStorageCache } from "@/lib/storage";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(80),
  type: z.enum(["LOCAL", "R2", "S3", "B2", "MINIO", "WASABI", "CUSTOM_S3"]),
  endpoint: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  bucket: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  publicUrl: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const data = parsed.data;

  // Si on définit ce backend comme default, dé-défaut tous les autres
  if (data.isDefault) {
    await db.storageBackend.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }

  let saved;
  if (data.id) {
    saved = await db.storageBackend.update({
      where: { id: data.id },
      data: { ...data, id: undefined },
    });
  } else {
    saved = await db.storageBackend.create({ data: { ...data, id: undefined } });
  }

  invalidateStorageCache();
  await db.adminAuditLog.create({
    data: {
      actorId: admin.id,
      action: data.id ? "storage.update" : "storage.create",
      targetType: "StorageBackend",
      targetId: saved.id,
    },
  });
  return NextResponse.json({ ok: true, backend: { id: saved.id, name: saved.name } });
}

export async function DELETE(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
  const count = await db.file.count({ where: { storageBackendId: id } });
  if (count > 0) {
    return NextResponse.json(
      { error: "BACKEND_IN_USE", message: `${count} fichiers dépendent de ce backend.` },
      { status: 400 }
    );
  }
  await db.storageBackend.delete({ where: { id } });
  invalidateStorageCache(id);
  await db.adminAuditLog.create({
    data: { actorId: admin.id, action: "storage.delete", targetType: "StorageBackend", targetId: id },
  });
  return NextResponse.json({ ok: true });
}
