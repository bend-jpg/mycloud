import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getAppUrl } from "@/lib/url";

const schema = z.object({
  planSlug: z.string().min(1),
  cycle: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  currency: z.enum(["EUR", "USD"]).default("EUR"),
});

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const { planSlug, cycle, currency } = parsed.data;

  const plan = await db.plan.findUnique({ where: { slug: planSlug } });
  if (!plan) return NextResponse.json({ error: "PLAN_NOT_FOUND" }, { status: 404 });

  const priceId =
    cycle === "MONTHLY"
      ? currency === "EUR"
        ? plan.stripePriceMonthlyEurId
        : plan.stripePriceMonthlyUsdId
      : currency === "EUR"
      ? plan.stripePriceYearlyEurId
      : plan.stripePriceYearlyUsdId;

  if (!priceId) {
    return NextResponse.json(
      { error: "STRIPE_PRICE_MISSING", message: "Le plan n'est pas synchronisé avec Stripe. Admin doit lancer la sync." },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const baseUrl = getAppUrl();

  // Récupère/crée le Customer Stripe associé au user
  const user = await db.user.findUnique({
    where: { id: session.id },
    include: { subscription: true },
  });
  if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

  let customerId = user.subscription?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { mycloudUserId: user.id },
    });
    customerId = customer.id;
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/billing?canceled=1`,
    allow_promotion_codes: true,
    locale: session.locale === "he" ? "auto" : (session.locale as "fr" | "en" | "es"),
    billing_address_collection: "auto",
    metadata: { mycloudUserId: user.id, planSlug, cycle, currency },
    subscription_data: {
      metadata: { mycloudUserId: user.id, planSlug, cycle, currency },
    },
  });

  return NextResponse.json({ ok: true, url: checkout.url });
}
