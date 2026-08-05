// Configuration Sentry — navigateur.
//
// Remonte les erreurs JavaScript que rencontrent réellement les clients :
// c'est ce qui manquait le plus. Un bug d'interface (bouton qui ne répond
// pas, envoi qui échoue) était jusqu'ici invisible côté équipe.
//
// Le DSN doit être NEXT_PUBLIC_ pour être disponible dans le navigateur.
// C'est sans risque : un DSN ne permet que d'ENVOYER des événements, il ne
// donne aucun accès au compte Sentry.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,

    // Aucune donnée personnelle transmise : ce service héberge des fichiers
    // privés, on n'exporte ni corps de requête ni en-têtes.
    sendDefaultPii: false,

    // Rejeu de session désactivé : il enregistrerait le contenu des pages,
    // donc les noms de fichiers des clients.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    ignoreErrors: [
      // Bruit typique des navigateurs et extensions, sans lien avec l'app
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
      /^Failed to fetch$/,
      /^NetworkError/,
      /extension\//i,
    ],
  });
}

// Requis par Next.js pour instrumenter les transitions de navigation.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
