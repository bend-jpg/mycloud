import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/**
 * En-têtes de sécurité HTTP.
 *
 * Aucun n'était défini : le site était exposé au clickjacking (aucune
 * protection contre l'affichage en iframe sur un site tiers), au sniffing
 * de type MIME, et sans HSTS. Ces en-têtes sont ajoutés sur TOUTES les
 * routes — ils ne cassent rien côté application.
 *
 * Note : pas de Content-Security-Policy stricte ici. Next.js injecte des
 * scripts/styles inline, et une CSP mal calibrée casserait Stripe, les
 * aperçus R2 et l'hydratation. Elle doit être introduite séparément, en
 * Report-Only d'abord, puis appliquée après observation. C'est identifié
 * comme un chantier à part.
 */
const securityHeaders = [
  // Interdit l'affichage du site dans une iframe tierce (clickjacking)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Empêche le navigateur de "deviner" un type MIME différent de celui
  // annoncé — bloque une classe d'attaques par fichier uploadé
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Ne fuite pas l'URL complète (qui peut contenir un token de partage)
  // vers les sites externes
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Force HTTPS pendant 2 ans, sous-domaines inclus
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Coupe l'accès aux capteurs dont l'app n'a pas besoin
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()" },
  // Isole l'origine des fenêtres ouvertes
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "pub-*.r2.dev" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google avatars
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
