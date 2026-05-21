// Gestion des codes promo via Stripe (Promotion Codes + Coupons).
// GET    → liste tous les promotion codes avec leur coupon associé
// POST   → crée un coupon Stripe + promotion code en un appel
// DELETE → désactive (Stripe ne supprime pas réellement) un promotion code

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

const createSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9_-]+$/i, "Caractères autorisés : lettres, chiffres, _, -"),
  // Discount : soit pourcentage soit montant fixe
  discountType: z.enum(["PERCENT", "FIXED_EUR"]),
  discountValue: z.number().positive(),
  // Durée : once = un seul paiement, forever = à vie, repeating = N mois
  duration: z.enum(["once", "forever", "repeating"]).default("once"),
  durationInMonths: z.number().int().min(1).max(36).optional(),
  // Limites
  maxRedemptions: z.number().int().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 400 });
  }

  const stripe = getStripe();
  const promos = await stripe.promotionCodes.list({
    limit: 100,
    expand: ["data.promotion.coupon"],
  });

  const items = promos.data.map((p) => {
    const coupon = p.promotion?.coupon;
    const c = typeof coupon === "object" && coupon !== null ? coupon : null;
    return {
      id: p.id,
      code: p.code,
      active: p.active,
      timesRedeemed: p.times_redeemed,
      maxRedemptions: p.max_redemptions,
      expiresAt: p.expires_at ? new Date(p.expires_at * 1000).toISOString() : null,
      createdAt: new Date(p.created * 1000).toISOString(),
      coupon: {
        id: c?.id ?? null,
        name: c?.name ?? null,
        percentOff: c?.percent_off ?? null,
        amountOff: c?.amount_off ?? null,
        currency: c?.currency ?? null,
        duration: c?.duration ?? "once",
        durationInMonths: c?.duration_in_months ?? null,
        valid: c?.valid ?? false,
      },
    };
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const stripe = getStripe();

  // 1. Crée le coupon Stripe (la règle de réduction)
  const couponParams: Parameters<typeof stripe.coupons.create>[0] = {
    duration: data.duration,
    name: data.code,
  };
  if (data.discountType === "PERCENT") {
    couponParams.percent_off = data.discountValue;
  } else {
    couponParams.amount_off = Math.round(data.discountValue * 100); // EUR → cents
    couponParams.currency = "eur";
  }
  if (data.duration === "repeating" && data.durationInMonths) {
    couponParams.duration_in_months = data.durationInMonths;
  }

  let coupon;
  try {
    coupon = await stripe.coupons.create(couponParams);
  } catch (e) {
    return NextResponse.json(
      { error: "STRIPE_COUPON_FAILED", message: e instanceof Error ? e.message : "Stripe error" },
      { status: 400 },
    );
  }

  // 2. Crée le promotion code (le code que le client saisit)
  const promoParams: Parameters<typeof stripe.promotionCodes.create>[0] = {
    promotion: { coupon: coupon.id, type: "coupon" },
    code: data.code.toUpperCase(),
  };
  if (data.maxRedemptions) promoParams.max_redemptions = data.maxRedemptions;
  if (data.expiresAt) promoParams.expires_at = Math.floor(new Date(data.expiresAt).getTime() / 1000);

  let promo;
  try {
    promo = await stripe.promotionCodes.create(promoParams);
  } catch (e) {
    // Si le code existe déjà ou conflit : on supprime le coupon pour pas laisser de fantôme
    try {
      await stripe.coupons.del(coupon.id);
    } catch {}
    return NextResponse.json(
      { error: "STRIPE_PROMO_FAILED", message: e instanceof Error ? e.message : "Stripe error" },
      { status: 400 },
    );
  }

  await db.adminAuditLog.create({
    data: {
      actorId: admin.id,
      action: "coupon.create",
      targetType: "StripePromotionCode",
      targetId: promo.id,
      metadata: { ...data, codeSaved: data.code } as object,
    },
  });

  return NextResponse.json({ ok: true, promotionCodeId: promo.id, code: promo.code });
}

export async function DELETE(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 400 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

  const stripe = getStripe();
  // Stripe ne permet pas de supprimer un promotion code, seulement de le désactiver
  await stripe.promotionCodes.update(id, { active: false });

  await db.adminAuditLog.create({
    data: {
      actorId: admin.id,
      action: "coupon.disable",
      targetType: "StripePromotionCode",
      targetId: id,
    },
  });

  return NextResponse.json({ ok: true });
}
