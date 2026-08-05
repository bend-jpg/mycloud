import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { deleteUserCompletely } from "@/lib/delete-user";

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
    // Le quota n'est un OVERRIDE que si l'admin l'a réellement modifié.
    // Les formulaires envoient le champ même quand il n'a pas été touché :
    // en l'appliquant aveuglément après le plan, on écrasait le quota du
    // nouveau plan par l'ancienne valeur (client passé en Famille qui restait
    // plafonné à 50 Go). On compare donc à la valeur actuelle en base.
    const current = await db.user.findUnique({
      where: { id },
      select: { storageQuota: true },
    });
    const requested = BigInt(data.storageQuotaBytes);
    const unchanged = current !== null && current.storageQuota === requested;
    if (!unchanged || updates.storageQuota === undefined) {
      updates.storageQuota = requested;
      auditChanges.storageQuotaBytes = data.storageQuotaBytes;
    }
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

  // Garde-fou : un administrateur ne peut pas supprimer son propre compte
  // depuis cette interface (il se verrouillerait dehors, et on perdrait
  // potentiellement le dernier accès admin).
  if (id === admin.id) {
    return NextResponse.json(
      { error: "SELF_DELETE", message: "Tu ne peux pas supprimer ton propre compte administrateur." },
      { status: 400 },
    );
  }

  // Trace AVANT la suppression : une fois l'utilisateur effacé, on ne peut
  // plus lire son email pour le journal.
  const target = await db.user.findUnique({ where: { id }, select: { email: true } });
  if (!target) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Supprime aussi les objets de stockage (RGPD + coût). Voir lib/delete-user.
  const result = await deleteUserCompletely(id);

  await db.adminAuditLog.create({
    data: {
      actorId: admin.id,
      action: "client.delete",
      targetType: "User",
      targetId: id,
      metadata: {
        email: target.email,
        deletedObjects: result.deletedObjects,
        keptSharedObjects: result.keptSharedObjects,
        storageErrors: result.storageErrors,
      } as object,
    },
  });

  return NextResponse.json({ ok: true, ...result });
}
