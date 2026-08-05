// Configuration Sentry — exécution Edge (middleware next-intl).
//
// Le runtime Edge n'a pas accès aux API Node : le SDK y est plus limité,
// d'où un fichier séparé. Inactif si le DSN n'est pas défini.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    ignoreErrors: ["NEXT_REDIRECT", "NEXT_NOT_FOUND"],
  });
}
