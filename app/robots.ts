// robots.txt dynamique — autorise tout sauf les pages privées.

import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/url";

export default function robots(): MetadataRoute.Robots {
  const base = getAppUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/api/",
          "/admin",
          "/dashboard",
          "/files",
          "/family",
          "/accounts",
          "/shares",
          "/trash",
          "/notifications",
          "/security",
          "/settings",
          "/billing",
          "/support",
          "/s/", // tokens de partage : pas indexés (privés ou éphémères)
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
