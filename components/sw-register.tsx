"use client";

// Enregistre le Service Worker côté client au mount. Indispensable pour
// que Chrome/Edge déclenchent beforeinstallprompt et que la PWA soit
// considérée comme "installable".
//
// On enregistre seulement en production — en dev ça génère des warnings
// et complique les hot reloads.

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    // Enregistre après load pour ne pas concurrencer le rendu initial
    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          // En cas d'erreur on log silencieusement — pas critique
          console.warn("[mytitancloud] SW register failed:", err);
        });
    };

    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad, { once: true });
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  return null;
}
