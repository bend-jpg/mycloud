// Helper qui retourne l'URL publique de l'app.
// Auto-détecté sur Vercel — pas besoin de variable d'env explicite.

export function getAppUrl(): string {
  // 1. Override explicite (utile pour custom domain)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return stripTrailingSlash(process.env.NEXT_PUBLIC_APP_URL);
  }

  // 2. URL canonique de production Vercel (auto-injectée)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  // 3. URL du deployment courant (preview / prod auto-assigné)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 4. Local dev fallback
  return "http://localhost:3000";
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
