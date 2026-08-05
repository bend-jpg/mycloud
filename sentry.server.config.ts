// Configuration Sentry — exécution serveur (Node.js).
//
// Jusqu'ici, aucune erreur de production n'était remontée : une panne chez
// un client n'était découverte que s'il prenait la peine de la signaler.
//
// Si SENTRY_DSN n'est pas défini, le SDK ne fait rien du tout — c'est
// volontaire : le développement local et les environnements sans compte
// Sentry ne doivent pas être pollués ni ralentis.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,

    // 10 % des transactions suffisent pour détecter les tendances de
    // performance sans consommer le quota gratuit (5 000 événements/mois).
    tracesSampleRate: 0.1,

    // Les données personnelles ne partent pas chez Sentry : ce service
    // stocke des fichiers privés, il n'y a aucune raison d'exporter des
    // en-têtes ou des corps de requête pouvant contenir des identifiants.
    sendDefaultPii: false,

    beforeSend(event) {
      // Retire les valeurs sensibles qui pourraient se glisser dans les
      // URL (jetons de partage, jetons de vérification d'email).
      if (event.request?.url) {
        event.request.url = event.request.url
          .replace(/([?&]token=)[^&]+/gi, "$1[masqué]")
          .replace(/(\/s\/)[^/?]+/g, "$1[masqué]");
      }
      return event;
    },

    ignoreErrors: [
      // Bruit de fond sans valeur diagnostique
      "NEXT_REDIRECT",
      "NEXT_NOT_FOUND",
    ],
  });
}
