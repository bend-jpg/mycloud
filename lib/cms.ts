// Helper qui lit les overrides CMS pour une locale donnée.
// Utilise React cache() pour ne charger qu'une fois par requête.

import { cache } from "react";
import { db } from "./db";

const SUPPORTED_LOCALES = ["fr", "en", "es", "he"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Toutes les clés éditables depuis le CMS, avec leur fallback i18n attendu. */
export const CMS_KEYS = [
  // Hero
  { key: "tagline", label: "Bandeau au-dessus du titre", placeholder: "Cloud + WeTransfer + NAS familial en une seule app", group: "hero" },
  { key: "hero.title", label: "Titre principal", placeholder: "(grand titre du hero)", group: "hero" },
  { key: "hero.subtitle", label: "Sous-titre", placeholder: "(phrase descriptive sous le titre)", group: "hero" },
  { key: "hero.ctaStart", label: "Bouton principal", placeholder: "Démarrer gratuitement", group: "hero" },
  { key: "hero.ctaPricing", label: "Bouton secondaire", placeholder: "Voir les tarifs", group: "hero" },
  // Features
  { key: "features.title", label: "Titre section Features", placeholder: "Tout ce dont tu as besoin", group: "features" },
  // Pricing
  { key: "pricing.title", label: "Titre section Tarifs", placeholder: "Choisis ton plan", group: "pricing" },
  { key: "pricing.subtitle", label: "Sous-titre Tarifs", placeholder: "Annule à tout moment.", group: "pricing" },
] as const;

export type CmsKey = (typeof CMS_KEYS)[number]["key"];

/** Charge tous les CmsBlocks d'une locale en un dict { key: value }. */
export const getCmsBlocks = cache(async (locale: string): Promise<Record<string, string>> => {
  const safeLocale = SUPPORTED_LOCALES.includes(locale as Locale) ? locale : "fr";
  try {
    const blocks = await db.cmsBlock.findMany({
      where: { locale: safeLocale },
      select: { key: true, value: true },
    });
    const dict: Record<string, string> = {};
    for (const b of blocks) dict[b.key] = b.value;
    return dict;
  } catch {
    // Si la table n'existe pas encore (migration non poussée), on tombe sur les défauts
    return {};
  }
});

/**
 * Renvoie soit l'override CMS pour cette clé, soit le fallback.
 * Le fallback est typiquement un texte i18n résolu en amont.
 */
export function cmsOrFallback(blocks: Record<string, string>, key: string, fallback: string): string {
  return blocks[key] && blocks[key].trim().length > 0 ? blocks[key] : fallback;
}

/** Liste de toutes les locales supportées par le CMS. */
export function getSupportedLocales(): readonly string[] {
  return SUPPORTED_LOCALES;
}
