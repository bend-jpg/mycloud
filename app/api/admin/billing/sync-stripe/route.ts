// Synchronise nos plans DB vers Stripe (idempotent).
// Crée 1 Product par plan + 4 Prices (monthly/yearly × EUR/USD).
// Met à jour la DB avec les IDs Stripe.
// À appeler une fois après chaque modification de plan.

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export async function POST() {
  let admin;
  try {
    admin = await requirePermission("plan.write");
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 400 });
  }

  const stripe = getStripe();
  const plans = await db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });

  const results: Array<{
    plan: string;
    productId: string;
    priceMonthlyEurId: string;
    priceYearlyEurId: string;
    priceMonthlyUsdId: string;
    priceYearlyUsdId: string;
  }> = [];

  for (const plan of plans) {
    // 1. Product : on cherche par metadata.slug pour rester idempotent
    let product: Stripe.Product | null = null;
    if (plan.stripeProductId) {
      product = await stripe.products.retrieve(plan.stripeProductId).catch(() => null);
    }
    if (!product) {
      const existing = await stripe.products.search({
        query: `metadata['mycloudSlug']:'${plan.slug}'`,
      });
      product = existing.data[0] ?? null;
    }
    if (!product) {
      product = await stripe.products.create({
        name: plan.name,
        description: plan.descriptionFr ?? plan.descriptionEn ?? undefined,
        metadata: { mycloudSlug: plan.slug },
      });
    } else {
      product = await stripe.products.update(product.id, {
        name: plan.name,
        description: plan.descriptionFr ?? plan.descriptionEn ?? undefined,
        metadata: { mycloudSlug: plan.slug },
      });
    }
    const productId = product.id;

    // 2. Prices : un par devise × cycle. On utilise lookup_key pour retrouver.
    async function ensurePrice(
      cycle: "month" | "year",
      currency: "eur" | "usd",
      amount: number
    ): Promise<string> {
      const lookupKey = `mycloud_${plan.slug}_${cycle}_${currency}`;
      const list = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
      if (list.data[0] && list.data[0].unit_amount === amount) return list.data[0].id;
      // Si le montant a changé : transfer_lookup_key=true détache la clé de
      // l'ancien prix et l'attache au nouveau (Stripe interdit l'édition du montant).
      const created = await stripe.prices.create({
        product: productId,
        currency,
        unit_amount: amount,
        recurring: { interval: cycle },
        lookup_key: lookupKey,
        transfer_lookup_key: true,
      });
      if (list.data[0]) {
        await stripe.prices.update(list.data[0].id, { active: false });
      }
      return created.id;
    }

    const [priceMonthlyEurId, priceYearlyEurId, priceMonthlyUsdId, priceYearlyUsdId] = await Promise.all([
      ensurePrice("month", "eur", plan.priceMonthlyEur),
      ensurePrice("year", "eur", plan.priceYearlyEur),
      ensurePrice("month", "usd", plan.priceMonthlyUsd),
      ensurePrice("year", "usd", plan.priceYearlyUsd),
    ]);

    await db.plan.update({
      where: { id: plan.id },
      data: {
        stripeProductId: productId,
        stripePriceMonthlyEurId: priceMonthlyEurId,
        stripePriceYearlyEurId: priceYearlyEurId,
        stripePriceMonthlyUsdId: priceMonthlyUsdId,
        stripePriceYearlyUsdId: priceYearlyUsdId,
      },
    });

    results.push({
      plan: plan.slug,
      productId,
      priceMonthlyEurId,
      priceYearlyEurId,
      priceMonthlyUsdId,
      priceYearlyUsdId,
    });
  }

  await db.adminAuditLog.create({
    data: { actorId: admin.id, action: "billing.sync_stripe", metadata: { count: results.length } as object },
  });

  return NextResponse.json({ ok: true, synced: results });
}
