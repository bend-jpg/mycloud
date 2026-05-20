// Webhook Coinbase Commerce — déclenché à la confirmation du paiement crypto.
// On étend l'abonnement de l'utilisateur de 1 mois ou 1 an.

import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";

export const runtime = "nodejs";

interface ChargeEvent {
  event: { type: string; data: { id: string; metadata?: Record<string, string>; pricing?: { local?: { amount: string; currency: string } } } };
}

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function POST(req: Request) {
  const secret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "WEBHOOK_NOT_CONFIGURED" }, { status: 500 });

  const signature = req.headers.get("x-cc-webhook-signature");
  const rawBody = await req.text();
  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
  }

  const payload = JSON.parse(rawBody) as ChargeEvent;
  const evt = payload.event;

  // On agit seulement à la confirmation finale du paiement
  if (evt.type !== "charge:confirmed" && evt.type !== "charge:resolved") {
    return NextResponse.json({ received: true, ignored: evt.type });
  }

  const metadata = evt.data.metadata ?? {};
  const userId = metadata.mycloudUserId;
  const planSlug = metadata.planSlug;
  const cycle = (metadata.cycle as "MONTHLY" | "YEARLY") ?? "MONTHLY";
  const currency = (metadata.currency as "EUR" | "USD") ?? "EUR";
  if (!userId || !planSlug) {
    return NextResponse.json({ error: "MISSING_METADATA" }, { status: 400 });
  }

  const plan = await db.plan.findUnique({ where: { slug: planSlug } });
  if (!plan) return NextResponse.json({ error: "PLAN_NOT_FOUND" }, { status: 404 });

  const now = new Date();
  const periodMs = (cycle === "MONTHLY" ? 30 : 365) * 86400_000;

  // Étend l'abonnement existant ou en crée un nouveau
  const existing = await db.subscription.findUnique({ where: { userId } });
  const start = existing && existing.currentPeriodEnd > now ? existing.currentPeriodEnd : now;
  const end = new Date(start.getTime() + periodMs);

  const amount = Math.round(parseFloat(evt.data.pricing?.local?.amount ?? "0") * 100);

  await db.$transaction([
    db.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planId: plan.id,
        status: "ACTIVE",
        cycle,
        currency,
        currentPeriodStart: start,
        currentPeriodEnd: end,
      },
      update: {
        planId: plan.id,
        status: "ACTIVE",
        cycle,
        currency,
        currentPeriodEnd: end,
      },
    }),
    db.user.update({ where: { id: userId }, data: { planId: plan.id, storageQuota: plan.storageBytes } }),
    db.payment.create({
      data: {
        userId,
        amount,
        currency,
        method: "CRYPTO",
        status: "SUCCEEDED",
        externalRef: evt.data.id,
        invoiceNumber: `CRYPTO-${evt.data.id.slice(0, 8).toUpperCase()}`,
        paidAt: now,
      },
    }),
  ]);

  return NextResponse.json({ received: true });
}
