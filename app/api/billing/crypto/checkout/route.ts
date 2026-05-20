// Crée une charge Coinbase Commerce pour un paiement unique en crypto.
// L'utilisateur paye X € en crypto → on étend son abonnement de 1 mois ou 1 an.

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
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
  const apiKey = process.env.COINBASE_COMMERCE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "CRYPTO_NOT_CONFIGURED" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const { planSlug, cycle, currency } = parsed.data;

  const plan = await db.plan.findUnique({ where: { slug: planSlug } });
  if (!plan) return NextResponse.json({ error: "PLAN_NOT_FOUND" }, { status: 404 });

  const amount =
    cycle === "MONTHLY"
      ? currency === "EUR"
        ? plan.priceMonthlyEur
        : plan.priceMonthlyUsd
      : currency === "EUR"
      ? plan.priceYearlyEur
      : plan.priceYearlyUsd;

  // Appel direct à l'API Coinbase Commerce (le SDK officiel CJS pose souci avec Next)
  const res = await fetch("https://api.commerce.coinbase.com/charges", {
    method: "POST",
    headers: {
      "X-CC-Api-Key": apiKey,
      "X-CC-Version": "2018-03-22",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `MyCloud ${plan.name} (${cycle === "MONTHLY" ? "1 mois" : "1 an"})`,
      description: `Abonnement ${plan.name} payé en crypto`,
      pricing_type: "fixed_price",
      local_price: {
        amount: (amount / 100).toFixed(2),
        currency,
      },
      metadata: {
        mycloudUserId: session.id,
        planSlug,
        cycle,
        currency,
      },
      redirect_url: `${getAppUrl()}/billing?crypto=success`,
      cancel_url: `${getAppUrl()}/billing?crypto=canceled`,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[crypto] coinbase commerce error", err);
    return NextResponse.json({ error: "COINBASE_ERROR" }, { status: 502 });
  }
  const data = await res.json();
  return NextResponse.json({ ok: true, url: data.data.hosted_url, chargeId: data.data.id });
}
