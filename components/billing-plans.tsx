"use client";

import { useState } from "react";
import { Check, Bitcoin, CreditCard, Loader2 } from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface Plan {
  slug: string;
  name: string;
  storageBytes: string;
  maxMembers: number;
  websiteHosting: boolean;
  claudeCodeHosting: boolean;
  priceMonthlyEur: number;
  priceYearlyEur: number;
  priceMonthlyUsd: number;
  priceYearlyUsd: number;
  highlighted: boolean;
  hasStripeIds: boolean;
}

type Cycle = "MONTHLY" | "YEARLY";
type Currency = "EUR" | "USD";

export function BillingPlans({
  plans,
  currentPlanSlug,
}: {
  plans: Plan[];
  currentPlanSlug: string | null;
}) {
  const [cycle, setCycle] = useState<Cycle>("MONTHLY");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [loading, setLoading] = useState<string | null>(null);

  async function startCheckout(planSlug: string, method: "stripe" | "crypto") {
    setLoading(`${planSlug}-${method}`);
    const path = method === "stripe" ? "/api/billing/checkout" : "/api/billing/crypto/checkout";
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug, cycle, currency }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message ?? data.error ?? "Erreur");
        setLoading(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      alert("Erreur réseau");
      setLoading(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex rounded-full border border-[var(--border)] p-1 bg-[var(--background-tile)]">
          <button
            onClick={() => setCycle("MONTHLY")}
            className={`px-3 py-1 text-sm rounded-full ${cycle === "MONTHLY" ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : ""}`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setCycle("YEARLY")}
            className={`px-3 py-1 text-sm rounded-full ${cycle === "YEARLY" ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : ""}`}
          >
            Annuel <span className="text-xs opacity-70">(-17%)</span>
          </button>
        </div>
        <div className="inline-flex rounded-full border border-[var(--border)] p-1 bg-[var(--background-tile)]">
          {(["EUR", "USD"] as Currency[]).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`px-3 py-1 text-sm rounded-full ${currency === c ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : ""}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((p) => {
          const price =
            cycle === "MONTHLY"
              ? currency === "EUR"
                ? p.priceMonthlyEur
                : p.priceMonthlyUsd
              : currency === "EUR"
              ? p.priceYearlyEur
              : p.priceYearlyUsd;
          const symbol = currency === "EUR" ? "€" : "$";
          const isCurrent = p.slug === currentPlanSlug;

          return (
            <div
              key={p.slug}
              className={`tile cursor-default !min-h-0 relative ${
                p.highlighted ? "ring-2 ring-[var(--accent)]" : ""
              } ${isCurrent ? "opacity-90" : ""}`}
            >
              {isCurrent && (
                <span className="absolute -top-3 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 text-xs font-medium rounded-full bg-[var(--success)] text-[var(--accent-foreground)] px-3 py-1">
                  Plan actuel
                </span>
              )}
              {p.highlighted && !isCurrent && (
                <span className="absolute -top-3 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 text-xs font-medium rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] px-3 py-1">
                  Populaire
                </span>
              )}
              <h3 className="text-xl font-bold">{p.name}</h3>
              <div className="my-3">
                <span className="text-3xl font-bold">
                  {(price / 100).toFixed(2)} {symbol}
                </span>
                <span className="text-[var(--foreground-muted)] text-sm ms-1">
                  /{cycle === "MONTHLY" ? "mois" : "an"}
                </span>
              </div>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-[var(--success)]" />
                  {formatBytes(Number(p.storageBytes))}
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-[var(--success)]" />
                  {p.maxMembers} membre{p.maxMembers > 1 ? "s" : ""}
                </li>
                {p.websiteHosting && (
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-[var(--success)]" />
                    Hébergement sites
                  </li>
                )}
                {p.claudeCodeHosting && (
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-[var(--success)]" />
                    Claude Code
                  </li>
                )}
              </ul>

              {!isCurrent && (
                <div className="mt-4 space-y-2">
                  <button
                    disabled={!p.hasStripeIds || loading !== null}
                    onClick={() => startCheckout(p.slug, "stripe")}
                    className="btn-primary w-full justify-center text-sm disabled:opacity-50"
                    title={!p.hasStripeIds ? "Admin doit synchroniser ce plan avec Stripe d'abord" : ""}
                  >
                    {loading === `${p.slug}-stripe` ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CreditCard className="size-4" />
                    )}
                    Payer par carte
                  </button>
                  <button
                    disabled={loading !== null}
                    onClick={() => startCheckout(p.slug, "crypto")}
                    className="btn-ghost w-full justify-center text-sm disabled:opacity-50"
                  >
                    {loading === `${p.slug}-crypto` ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Bitcoin className="size-4" />
                    )}
                    Payer en crypto
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
