// Liste + création de codes promo Stripe.

export const dynamic = "force-dynamic";

import { setRequestLocale } from "next-intl/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { CouponsView } from "@/components/admin-coupons-view";
import { Tag, AlertTriangle } from "lucide-react";
import { guardAdminPage } from "@/lib/admin-guard";

export default async function AdminCouponsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await guardAdminPage("page.coupons", locale);

  if (!isStripeConfigured()) {
    return (
      <main className="p-4 sm:p-8 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Tag className="size-7 text-[var(--accent)]" />
            Codes promo
          </h1>
        </div>
        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 flex items-start gap-3">
          <AlertTriangle className="size-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">Stripe non configuré</p>
            <p className="text-xs text-[var(--foreground-muted)] mt-1">
              Configure <code>STRIPE_SECRET_KEY</code> dans tes variables d&apos;environnement
              Vercel pour gérer les codes promo.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Charge les promotion codes Stripe
  const stripe = getStripe();
  let items: Array<{
    id: string;
    code: string;
    active: boolean;
    timesRedeemed: number;
    maxRedemptions: number | null;
    expiresAt: string | null;
    createdAt: string;
    coupon: {
      percentOff: number | null;
      amountOff: number | null;
      currency: string | null;
      duration: string;
      durationInMonths: number | null;
      valid: boolean;
    };
  }> = [];

  try {
    const promos = await stripe.promotionCodes.list({
      limit: 100,
      expand: ["data.promotion.coupon"],
    });
    items = promos.data.map((p) => {
      const coup = p.promotion?.coupon;
      const c = typeof coup === "object" && coup !== null ? coup : null;
      return {
        id: p.id,
        code: p.code,
        active: p.active,
        timesRedeemed: p.times_redeemed,
        maxRedemptions: p.max_redemptions,
        expiresAt: p.expires_at ? new Date(p.expires_at * 1000).toISOString() : null,
        createdAt: new Date(p.created * 1000).toISOString(),
        coupon: {
          percentOff: c?.percent_off ?? null,
          amountOff: c?.amount_off ?? null,
          currency: c?.currency ?? null,
          duration: c?.duration ?? "once",
          durationInMonths: c?.duration_in_months ?? null,
          valid: c?.valid ?? false,
        },
      };
    });
  } catch (e) {
    return (
      <main className="p-4 sm:p-8 space-y-6">
        <h1 className="text-3xl font-bold">Codes promo</h1>
        <p className="text-[var(--danger)]">Erreur Stripe : {e instanceof Error ? e.message : "inconnue"}</p>
      </main>
    );
  }

  const totalRedemptions = items.reduce((sum, p) => sum + p.timesRedeemed, 0);
  const activeCount = items.filter((p) => p.active).length;

  return (
    <main className="p-4 sm:p-8 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Tag className="size-7 text-[var(--accent)]" />
            Codes promo
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">
            {items.length} code(s) · {activeCount} actif(s) · {totalRedemptions} utilisation(s) au total.
            Le client saisit le code à la page de paiement Stripe.
          </p>
        </div>
      </div>

      <CouponsView items={items} />
    </main>
  );
}
