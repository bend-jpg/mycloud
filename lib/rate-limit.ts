// Rate limiting en mémoire (par instance Vercel).
// Suffisant pour bloquer du brute-force basique. Pour un anti-bot solide à grande
// échelle : passer à Upstash Redis ou Vercel KV (gardent l'état entre invocations).

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Nettoyage périodique pour éviter la fuite mémoire (purge toutes les 5 min)
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return;
  lastCleanup = now;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Vérifie + incrémente le bucket pour cette clé.
 * @param key Identifiant unique (ex: `signup:1.2.3.4` ou `share:tokenXYZ:1.2.3.4`)
 * @param max Nombre max d'actions autorisées dans la fenêtre
 * @param windowMs Durée de la fenêtre en millisecondes
 */
export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  cleanup();
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

/** Reset manuel (après login réussi par ex.) */
export function rateLimitReset(key: string): void {
  buckets.delete(key);
}

/** Extrait l'IP réelle d'une Request (Vercel met x-forwarded-for) */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
