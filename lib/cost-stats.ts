// Helpers pour calculer coûts/marge à plusieurs niveaux (user, backend, global).

import { db } from "./db";
import { storageCostMonthlyEur, marginEur } from "./pricing";
import type { StorageProviderType } from "@prisma/client";

export interface UserCostBreakdown {
  storageCostEur: number;          // coût mensuel estimé de stockage
  perBackend: Array<{
    backendId: string;
    backendName: string;
    type: StorageProviderType;
    bytes: number;
    costEur: number;
  }>;
}

/** Coût de stockage mensuel d'un client (somme sur tous les backends qu'il utilise) */
export async function userStorageCost(userId: string): Promise<UserCostBreakdown> {
  // Groupe les fichiers du user par backend
  const rows = await db.file.groupBy({
    by: ["storageBackendId"],
    where: { ownerId: userId, isTrash: false },
    _sum: { size: true },
  });

  const backendIds = rows.map((r) => r.storageBackendId);
  const backends = await db.storageBackend.findMany({
    where: { id: { in: backendIds } },
    select: { id: true, name: true, type: true },
  });
  const byId = new Map(backends.map((b) => [b.id, b]));

  const perBackend = rows.map((r) => {
    const b = byId.get(r.storageBackendId);
    const bytes = Number(r._sum.size ?? BigInt(0));
    return {
      backendId: r.storageBackendId,
      backendName: b?.name ?? "?",
      type: (b?.type ?? "CUSTOM_S3") as StorageProviderType,
      bytes,
      costEur: storageCostMonthlyEur(bytes, (b?.type ?? "CUSTOM_S3") as StorageProviderType),
    };
  });

  return {
    storageCostEur: perBackend.reduce((s, p) => s + p.costEur, 0),
    perBackend,
  };
}

/** Coût et marge d'un client (revenu = prix de son plan) */
export async function userCostAndMargin(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { plan: true, subscription: true },
  });
  if (!user) return null;

  const cost = await userStorageCost(userId);
  // Revenu : prix du plan selon le cycle de la subscription (ou mensuel par défaut)
  const cycle = user.subscription?.cycle ?? "MONTHLY";
  const currency = user.subscription?.currency ?? "EUR";
  const revenueCents = user.plan
    ? cycle === "YEARLY"
      ? currency === "USD"
        ? Math.round(user.plan.priceYearlyUsd / 12)
        : Math.round(user.plan.priceYearlyEur / 12)
      : currency === "USD"
      ? user.plan.priceMonthlyUsd
      : user.plan.priceMonthlyEur
    : 0;

  return {
    userId,
    planName: user.plan?.name ?? "—",
    revenueMonthlyCents: revenueCents,
    storageCostEur: cost.storageCostEur,
    marginEur: marginEur(revenueCents, cost.storageCostEur),
    perBackend: cost.perBackend,
  };
}

/** Stats globales pour le dashboard admin */
export async function globalCostStats() {
  const [backends, totalRevenue] = await Promise.all([
    db.storageBackend.findMany({
      select: { id: true, name: true, type: true, usedBytes: true },
    }),
    db.subscription.aggregate({
      where: { status: "ACTIVE" },
      _count: true,
    }),
  ]);

  // Revenu mensuel total (basé sur plans actifs des users)
  const activeUsers = await db.user.findMany({
    where: { plan: { isNot: null } },
    include: { plan: true, subscription: true },
  });
  const totalRevenueMonthlyEur = activeUsers.reduce((sum, u) => {
    if (!u.plan) return sum;
    const cycle = u.subscription?.cycle ?? "MONTHLY";
    const currency = u.subscription?.currency ?? "EUR";
    const cents =
      cycle === "YEARLY"
        ? currency === "USD"
          ? Math.round(u.plan.priceYearlyUsd / 12)
          : Math.round(u.plan.priceYearlyEur / 12)
        : currency === "USD"
        ? u.plan.priceMonthlyUsd
        : u.plan.priceMonthlyEur;
    return sum + cents / 100;
  }, 0);

  // Coût total par backend
  const perBackend = backends.map((b) => ({
    backendId: b.id,
    name: b.name,
    type: b.type,
    bytes: Number(b.usedBytes),
    costEur: storageCostMonthlyEur(b.usedBytes, b.type),
  }));
  const totalCostEur = perBackend.reduce((s, b) => s + b.costEur, 0);

  return {
    totalRevenueMonthlyEur,
    totalCostMonthlyEur: totalCostEur,
    totalMarginMonthlyEur: totalRevenueMonthlyEur - totalCostEur,
    activeSubscriptions: totalRevenue._count,
    perBackend,
  };
}
