// Helper unique pour détecter si la requête courante vient de l'app desktop
// Electron — utilisé en SSR par tous les composants qui veulent adapter leur
// rendu (cacher le SiteHeader, rediriger /dashboard, etc).
//
// Triple détection en cascade pour robustesse maximale :
//
//   1. Cookie `app_mode=desktop` — posé par Electron au démarrage de l'app
//      dans la session du webview. Voyage avec CHAQUE requête HTTP, donc
//      détection persistante entre navigations. C'est la source de vérité.
//
//   2. User-Agent contenant "MyTitanCloudDesktop/" — posé par Electron aussi.
//      Backup si le cookie n'est pas encore arrivé (race au tout 1er hit).
//
//   3. Query string `?app=desktop` — fallback ultime au tout premier loadURL
//      qui n'a ni cookie ni UA (rare mais possible si Vercel ne propage pas
//      le UA dans son edge config).

import { cache } from "react";
import { headers, cookies } from "next/headers";

// React.cache : appelée par SiteHeader + dashboard + breadcrumb + autres
// composants au même render → un seul vrai check, les autres mémoïsés.
export const isDesktopAppRequest = cache(async function isDesktopAppRequest(): Promise<boolean> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);

  // 1. Cookie — la source de vérité
  if (cookieStore.get("app_mode")?.value === "desktop") return true;

  // 2. User-Agent — pour le tout premier hit avant que le cookie soit posé
  const ua = headerStore.get("user-agent") ?? "";
  if (/MyTitanCloudDesktop\//.test(ua)) return true;

  // 3. URL search param — fallback ultime (initial loadURL avec ?app=desktop)
  // Le serveur ne voit pas le query côté layout/header, on s'arrête au cookie+UA
  return false;
});
