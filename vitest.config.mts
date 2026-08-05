// Configuration des tests unitaires.
//
// Le projet comptait 283 fichiers source pour UN seul test de fumée
// Playwright. C'est ce vide qui a permis à des défauts silencieux de vivre
// en production — une fuite de données admin, un éditeur qui détruisait les
// fichiers Excel, des listes tronquées sans le dire.
//
// Ces tests ciblent en priorité ce dont une panne est INVISIBLE : contrôle
// d'accès, détection de type de fichier, conversion de documents. Un bug
// d'affichage se voit ; un bug d'autorisation, non.
//
// Les tests Playwright de bout en bout restent séparés (`npm run test:e2e`) :
// ils demandent un serveur lancé, alors que ceux-ci tournent partout, y
// compris dans le CI sans base de données.
//
// Extension .mts : le fichier est en syntaxe ESM, et Vite chargera bientôt
// les configurations en natif où l'extension détermine le format.

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Résout les alias « @/… » du tsconfig, nativement (sans greffon).
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
});
