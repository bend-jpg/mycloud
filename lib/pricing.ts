// Tables tarifaires des fournisseurs de stockage (€/Go/mois et €/Go egress).
// Mise à jour : 2026-05. Update si les providers changent leurs grilles.

import type { StorageProviderType } from "@prisma/client";

// Taux EUR/USD figé (à remplacer par une API si besoin de précision)
const USD_TO_EUR = 0.92;

interface ProviderPricing {
  storagePerGbMonthEur: number;       // coût stockage
  egressPerGbEur: number;             // coût bande passante sortante
  freeEgressMultiplier?: number;      // ex B2 : 3x le stockage est gratuit en egress
  operationsCostEur?: number;         // approximation pour les opérations API
}

export const PROVIDER_PRICING: Record<StorageProviderType, ProviderPricing> = {
  LOCAL: {
    storagePerGbMonthEur: 0,
    egressPerGbEur: 0,
  },
  R2: {
    // $0.015/GB/mois stockage, egress GRATUIT
    storagePerGbMonthEur: 0.015 * USD_TO_EUR,
    egressPerGbEur: 0,
  },
  B2: {
    // $0.006/GB/mois stockage, $0.01/GB egress (3× stockage gratuit/mois)
    storagePerGbMonthEur: 0.006 * USD_TO_EUR,
    egressPerGbEur: 0.01 * USD_TO_EUR,
    freeEgressMultiplier: 3,
  },
  S3: {
    // $0.023/GB/mois (eu-west-3), $0.09/GB egress
    storagePerGbMonthEur: 0.023 * USD_TO_EUR,
    egressPerGbEur: 0.09 * USD_TO_EUR,
  },
  WASABI: {
    // $0.006875/GB/mois, egress gratuit (1× stockage)
    storagePerGbMonthEur: 0.006875 * USD_TO_EUR,
    egressPerGbEur: 0,
    freeEgressMultiplier: 1,
  },
  MINIO: {
    // Self-hosted : on ne compte pas (à l'admin d'estimer son TCO machine)
    storagePerGbMonthEur: 0,
    egressPerGbEur: 0,
  },
  CUSTOM_S3: {
    // Inconnu → on prend S3 par défaut, l'admin peut surcharger
    storagePerGbMonthEur: 0.023 * USD_TO_EUR,
    egressPerGbEur: 0.09 * USD_TO_EUR,
  },
};

/** Coût mensuel de stockage en €, à partir d'une quantité en octets */
export function storageCostMonthlyEur(bytes: bigint | number, providerType: StorageProviderType): number {
  const gb = Number(bytes) / 1024 ** 3;
  return gb * PROVIDER_PRICING[providerType].storagePerGbMonthEur;
}

/** Coût d'egress en € (sur 1 mois), avec free tier si applicable */
export function egressCostMonthlyEur(
  storedBytes: bigint | number,
  egressBytes: bigint | number,
  providerType: StorageProviderType
): number {
  const pricing = PROVIDER_PRICING[providerType];
  if (pricing.egressPerGbEur === 0) return 0;
  const storedGb = Number(storedBytes) / 1024 ** 3;
  const egressGb = Number(egressBytes) / 1024 ** 3;
  const freeGb = pricing.freeEgressMultiplier ? storedGb * pricing.freeEgressMultiplier : 0;
  const billableGb = Math.max(0, egressGb - freeGb);
  return billableGb * pricing.egressPerGbEur;
}

/** Marge brute mensuelle = prix payé par le client - coût hébergement */
export function marginEur(revenueCents: number, costEur: number): number {
  return revenueCents / 100 - costEur;
}

/** Code couleur selon la marge */
export function marginColor(marginEur: number, revenueCents: number): "good" | "ok" | "bad" {
  if (revenueCents === 0) return marginEur >= 0 ? "ok" : "bad";
  const ratio = marginEur / (revenueCents / 100);
  if (ratio >= 0.7) return "good";
  if (ratio >= 0.3) return "ok";
  return "bad";
}
