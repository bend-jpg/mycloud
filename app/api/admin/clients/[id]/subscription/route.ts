// Admin modifie manuellement la date de fin d'abonnement / le statut d'un client.
// Permet de prolonger gratuitement, étendre après un paiement espèces, etc.

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

const schema = z.object({
  currentPeriodEnd: z.string().datetime().optional(),
  status: z.enum(["ACTIVE", "PAST_DUE", "CANCELED", "TRIAL", "PAUSED"]).optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
});

export async function POST(
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

  const user = await db.user.findUnique({ where: { id }, include: { subscription: true, plan: true } });
  if (!user) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (parsed.data.currentPeriodEnd) updates.currentPeriodEnd = new Date(parsed.data.currentPeriodEnd);
  if (parsed.data.status) updates.status = parsed.data.status;
  if (parsed.data.cancelAtPeriodEnd !== undefined) updates.cancelAtPeriodEnd = parsed.data.cancelAtPeriodEnd;

  if (user.subscription) {
    await db.subscription.update({ where: { userId: id }, data: updates });
  } else if (user.plan) {
    // Crée une subscription manuelle (paiement hors Stripe, espèces / virement)
    await db.subscription.create({
      data: {
        userId: id,
        planId: user.plan.id,
        status: (parsed.data.status ?? "ACTIVE") as never,
        cycle: "MONTHLY",
        currency: "EUR",
        currentPeriodStart: new Date(),
        currentPeriodEnd: parsed.data.currentPeriodEnd ? new Date(parsed.data.currentPeriodEnd) : new Date(Date.now() + 30 * 86400_000),
        cancelAtPeriodEnd: parsed.data.cancelAtPeriodEnd ?? false,
      },
    });
  }

  await db.adminAuditLog.create({
    data: {
      actorId: admin.id,
      action: "client.subscription_update",
      targetType: "Subscription",
      targetId: id,
      metadata: parsed.data as object,
    },
  });

  return NextResponse.json({ ok: true });
}
