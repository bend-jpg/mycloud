import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing — configure-la dans Vercel ou .env.local");
  cached = new Stripe(key, {
    // Pas de fixed apiVersion → utilise la dernière (recommandé par Stripe)
    typescript: true,
    appInfo: { name: "MyTitanCloud", version: "0.1.0" },
  });
  return cached;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
