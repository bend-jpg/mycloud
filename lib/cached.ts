// Cache server-side pour données invariantes ou rarement modifiées.
// React `cache()` = dédup par requête. Module-level Map = dédup entre requêtes (5 min TTL).

import { cache } from "react";
import { db } from "./db";

interface CachedEntry<T> {
  value: T;
  expiresAt: number;
}
const moduleCache = new Map<string, CachedEntry<unknown>>();
const DEFAULT_TTL_MS = 5 * 60_000; // 5 min

function getCached<T>(key: string): T | null {
  const hit = moduleCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    moduleCache.delete(key);
    return null;
  }
  return hit.value as T;
}

function setCached<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  moduleCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Vide le cache pour une clé donnée (à appeler après mutation des plans/backends) */
export function invalidateCache(key: string): void {
  moduleCache.delete(key);
}

/** Tous les plans actifs — bouge très rarement, 5 min de cache largement OK */
export const getActivePlans = cache(async () => {
  const cached = getCached<Awaited<ReturnType<typeof fetchActivePlans>>>("active-plans");
  if (cached) return cached;
  const plans = await fetchActivePlans();
  setCached("active-plans", plans);
  return plans;
});

async function fetchActivePlans() {
  return db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
}

/** Backend storage par défaut — ne bouge presque jamais */
export const getDefaultStorageBackend = cache(async () => {
  const cached = getCached<Awaited<ReturnType<typeof fetchDefaultBackend>>>("default-backend");
  if (cached) return cached;
  const b = await fetchDefaultBackend();
  if (b) setCached("default-backend", b);
  return b;
});

async function fetchDefaultBackend() {
  return db.storageBackend.findFirst({ where: { isDefault: true, isActive: true } });
}
