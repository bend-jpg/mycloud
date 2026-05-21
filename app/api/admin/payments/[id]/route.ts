// Édition d'un paiement existant (status, notes) — utile pour marquer remboursé, échoué a posteriori, etc.

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const patchSchema = z.object({
  status: z.enum(["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"]).optional(),
  notes: z.string().max(500).optional().nullable(),
  paidAt: z.string().datetime().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  if (parsed.data.paidAt !== undefined) updates.paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : null;

  await db.$transaction([
    db.payment.update({ where: { id }, data: updates }),
    db.adminAuditLog.create({
      data: { actorId: admin.id, action: "payment.update", targetType: "Payment", targetId: id, metadata: parsed.data as object },
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
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id } = await params;
  await db.$transaction([
    db.payment.delete({ where: { id } }),
    db.adminAuditLog.create({
      data: { actorId: admin.id, action: "payment.delete", targetType: "Payment", targetId: id },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
