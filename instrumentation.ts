// Point d'entrée d'instrumentation Next.js (convention de fichier à la
// racine). `register` est appelé une seule fois au démarrage de chaque
// instance serveur, avant qu'elle n'accepte des requêtes.
//
// Le chargement conditionnel selon NEXT_RUNTIME est nécessaire : le SDK
// Node et le SDK Edge sont différents, et importer le mauvais casse le
// build de l'environnement correspondant.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Remonte les erreurs survenues pendant le rendu serveur et dans les route
// handlers. Sans ce hook, les erreurs des Server Components échappent à
// Sentry.
export const onRequestError = Sentry.captureRequestError;
