// Sitemap dynamique pour Google + autres moteurs.
// Liste toutes les pages publiques par locale.

import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/url";

const PUBLIC_PATHS = [
  "", // landing
  "/about",
  "/contact",
  "/download",
  "/legal",
  "/privacy",
  "/terms",
  "/login",
  "/signup",
] as const;

const LOCALES = ["fr", "en", "es", "he"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppUrl();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const path of PUBLIC_PATHS) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${base}/${locale}${path}`,
        lastModified: now,
        changeFrequency: path === "" ? "weekly" : "monthly",
        priority: path === "" ? 1.0 : 0.6,
        alternates: {
          languages: Object.fromEntries(LOCALES.map((l) => [l, `${base}/${l}${path}`])),
        },
      });
    }
  }

  return entries;
}
