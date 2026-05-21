import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

const schema = z
  .object({
    planSlug: z.string().optional(),
    storageQuotaBytes: z.string().optional(), // BigInt en string
    suspended: z.boolean().optional(),
    name: z.string().max(120).optional(),
    email: z.string().email().toLowerCase().optional(),
    phone: z.string().max(30).optional().nullable(),
    whatsapp: z.string().max(30).optional().nullable(),
    locale: z.enum(["fr", "en", "es", "he"]).optional(),
    role: z.enum(["USER", "ADMIN", "STAFF_SUPPORT", "STAFF_BILLING", "STAFF_OPS"]).optional(),
  })
  .strict();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin;
  try {
    admin = await requirePermission("client.modify");
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const data = parsed.data;

  const updates: Record<string, unknown> = {};
  const auditChanges: Record<string, unknown> = {};

  if (data.planSlug !== undefined) {
    const plan = await db.plan.findUnique({ where: { slug: data.planSlug } });
    if (!plan) return NextResponse.json({ error: "PLAN_NOT_FOUND" }, { status: 404 });
    updates.planId = plan.id;
    updates.storageQuota = plan.storageBytes;
    auditChanges.planSlug = data.planSlug;
  }
  if (data.storageQuotaBytes !== undefined) {
    updates.storageQuota = BigInt(data.storageQuotaBytes);
    auditChanges.storageQuotaBytes = data.storageQuotaBytes;
  }
  if (data.suspended !== undefined) {
    updates.suspendedAt = data.suspended ? new Date() : null;
    auditChanges.suspended = data.suspended;
  }
  if (data.name !== undefined) updates.name = data.name;
  if (data.email !== undefined) {
    // Vérifie unicité
    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: "EMAIL_ALREADY_USED" }, { status: 409 });
    }
    updates.email = data.email;
    auditChanges.email = data.email;
  }
  if (data.phone !== undefined) updates.phone = data.phone;
  if (data.whatsapp !== undefined) updates.whatsapp = data.whatsapp;
  if (data.locale !== undefined) updates.locale = data.locale;
  if (data.role !== undefined) {
    updates.role = data.role;
    auditChanges.role = data.role;
  }

  await db.$transaction([
    db.user.update({ where: { id }, data: updates }),
    db.adminAuditLog.create({
      data: {
        actorId: admin.id,
        action: "client.update",
        targetType: "User",
        targetId: id,
        metadata: auditChanges as object,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin;
  try {
    admin = await requirePermission("client.modify");
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id } = await params;
  await db.$transaction([
    db.user.delete({ where: { id } }),
    db.adminAuditLog.create({
      data: { actorId: admin.id, action: "client.delete", targetType: "User", targetId: id },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
