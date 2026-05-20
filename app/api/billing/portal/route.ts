// Ouvre le Stripe Customer Portal pour gérer son abonnement (changer plan, annuler, MAJ carte).
// Pré-requis : activer le Customer Portal dans le dashboard Stripe.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getAppUrl } from "@/lib/url";

export async function POST() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 400 });
  }
  const sub = await db.subscription.findUnique({ where: { userId: session.id } });
  if (!sub?.stripeCustomerId) {
    return NextResponse.json({ error: "NO_CUSTOMER", message: "Pas d'abonnement Stripe pour ce compte." }, { status: 400 });
  }
  const stripe = getStripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${getAppUrl()}/billing`,
  });
  return NextResponse.json({ ok: true, url: portal.url });
}
