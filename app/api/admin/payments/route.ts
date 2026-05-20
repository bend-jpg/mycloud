import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const schema = z.object({
  userId: z.string().min(1),
  amount: z.number().int().positive(), // centimes
  currency: z.enum(["EUR", "USD"]).default("EUR"),
  method: z.enum(["CASH", "BANK_TRANSFER", "CRYPTO", "OTHER", "CARD_STRIPE"]),
  notes: z.string().max(500).optional().nullable(),
  externalRef: z.string().max(120).optional().nullable(),
  paidAt: z.string().datetime().optional(),
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
  const { userId, amount, currency, method, notes, externalRef, paidAt } = parsed.data;

  const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const payment = await db.payment.create({
    data: {
      userId,
      amount,
      currency,
      method,
      status: "SUCCEEDED",
      notes,
      externalRef,
      recordedById: admin.id,
      invoiceNumber,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
    },
  });
  await db.adminAuditLog.create({
    data: {
      actorId: admin.id,
      action: "payment.record",
      targetType: "Payment",
      targetId: payment.id,
      metadata: { userId, amount, currency, method } as object,
    },
  });
  return NextResponse.json({ ok: true, payment: { id: payment.id, invoiceNumber } });
}
