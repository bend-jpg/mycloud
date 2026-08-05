// Limitation de débit PARTAGÉE entre toutes les instances (Upstash Redis).
//
// L'implémentation précédente stockait les compteurs dans une Map en
// mémoire. En serverless, chaque instance a sa propre mémoire : un
// attaquant dont les requêtes tombent sur des instances différentes n'était
// donc jamais bloqué. La protection contre la force brute sur les mots de
// passe était, en pratique, inopérante en production.
//
// Redis rend le compteur commun à toutes les instances. Si les variables
// Upstash ne sont pas définies (développement local, environnement de test),
// on retombe automatiquement sur la version mémoire — le service continue
// de fonctionner, simplement avec une protection plus faible.

import { Redis } from "@upstash/redis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ---------------------------------------------------------------------------
// Client Redis (créé une seule fois par instance)
// ---------------------------------------------------------------------------

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

/** Indique si la limitation est réellement partagée entre instances. */
export function isRateLimitDistributed(): boolean {
  return redis !== null;
}

// ---------------------------------------------------------------------------
// Repli mémoire (développement local, ou Redis indisponible)
// ---------------------------------------------------------------------------

interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();
let lastCleanup = Date.now();

function cleanupMemory() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return;
  lastCleanup = now;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

function memoryRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  cleanupMemory();
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
  }
  if (bucket.count >= max) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }
  bucket.count += 1;
  return { allowed: true, remaining: max - bucket.count, resetAt: bucket.resetAt };
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Vérifie et incrémente le compteur pour cette clé.
 *
 * @param key      Identifiant unique (ex. `login-ip:1.2.3.4`)
 * @param max      Nombre d'actions autorisées dans la fenêtre
 * @param windowMs Durée de la fenêtre, en millisecondes
 */
export async function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (!redis) return memoryRateLimit(key, max, windowMs);

  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const redisKey = `rl:${key}`;

  try {
    // INCR puis EXPIRE sur la première occurrence : fenêtre fixe, atomique
    // côté Redis. Volontairement simple — une fenêtre glissante coûterait
    // plus de commandes pour un gain négligeable ici.
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, windowSec);
    }

    const ttl = await redis.ttl(redisKey);
    const resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : windowMs);

    if (count > max) {
      return { allowed: false, remaining: 0, resetAt };
    }
    return { allowed: true, remaining: Math.max(0, max - count), resetAt };
  } catch (e) {
    // Redis injoignable : on n'ouvre pas les vannes en grand, on retombe sur
    // le compteur mémoire. Mieux vaut une protection partielle que rien.
    console.warn(
      "[rate-limit] Redis indisponible, repli mémoire :",
      e instanceof Error ? e.message : e,
    );
    return memoryRateLimit(key, max, windowMs);
  }
}

/** Remet le compteur à zéro (après une authentification réussie). */
export async function rateLimitReset(key: string): Promise<void> {
  buckets.delete(key);
  if (!redis) return;
  try {
    await redis.del(`rl:${key}`);
  } catch {
    // Sans conséquence : le compteur expirera de lui-même
  }
}

/** Extrait l'IP réelle de la requête (Vercel renseigne x-forwarded-for). */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
