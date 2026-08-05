#!/usr/bin/env node
/**
 * Vérifie que chaque page du back-office contrôle l'autorisation AVANT
 * d'interroger la base.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI CE CONTRÔLE EXISTE
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Le 5 août 2026, une requête anonyme sur /admin/storage renvoyait HTTP 200
 * contenant l'endpoint R2 complet (donc l'identifiant du compte Cloudflare),
 * le nom du bucket et les volumes stockés. 12 des 18 pages admin étaient
 * dans ce cas.
 *
 * La cause : le contrôle d'accès était dans le layout. Dans l'App Router,
 * Next rend le layout et la page EN PARALLÈLE — la redirection part, mais la
 * page a déjà exécuté ses requêtes et leurs résultats sont déjà sérialisés
 * dans la réponse. Le navigateur redirige et n'affiche rien, donc le trou
 * est INVISIBLE en usage normal. Seul un appel en ligne de commande le
 * révèle.
 *
 * C'est exactement le genre de faille qui revient : il suffit de créer une
 * nouvelle page admin sans y penser. D'où ce contrôle automatique, exécuté
 * à chaque envoi.
 *
 * Deux règles vérifiées :
 *   1. la page appelle guardAdminPage()
 *   2. elle l'appelle AVANT sa première requête base — sinon la requête
 *      part quand même
 *
 * Usage : node scripts/check-admin-guards.js
 * Sort en code 1 si une page est en défaut.
 */

const fs = require("fs");
const path = require("path");

const ADMIN_DIR = path.join("app", "[locale]", "(admin)");
const GUARD = /await\s+guardAdminPage\s*\(/;
const DB_CALL = /\bdb\s*\.\s*[a-zA-Z]+\s*\.\s*(findMany|findUnique|findFirst|count|aggregate|groupBy|create|update|delete|upsert)|\bdb\s*\.\s*\$queryRaw/;

function collectPages(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectPages(full));
    else if (entry.name === "page.tsx") out.push(full);
  }
  return out;
}

const pages = collectPages(ADMIN_DIR);
const problems = [];

for (const file of pages) {
  const source = fs.readFileSync(file, "utf8");
  const guardAt = source.search(GUARD);
  const dbAt = source.search(DB_CALL);

  // Une page sans aucune requête base ne peut rien divulguer.
  if (dbAt === -1) continue;

  if (guardAt === -1) {
    problems.push({ file, reason: "aucun appel à guardAdminPage() — la page interroge la base sans contrôle" });
  } else if (guardAt > dbAt) {
    problems.push({ file, reason: "guardAdminPage() appelé APRÈS la première requête base — la requête part quand même" });
  }
}

console.log(`Pages du back-office analysées : ${pages.length}`);

if (problems.length === 0) {
  console.log("✓ Toutes contrôlent l'autorisation avant d'interroger la base.");
  process.exit(0);
}

console.error(`\n✗ ${problems.length} page(s) en défaut :\n`);
for (const p of problems) {
  console.error(`  ${p.file}`);
  console.error(`    → ${p.reason}\n`);
}
console.error(
  "Corriger en ajoutant, juste après setRequestLocale(locale) et avant toute\n" +
    "requête :\n\n" +
    '    import { guardAdminPage } from "@/lib/admin-guard";\n' +
    '    await guardAdminPage("page.xxx", locale);\n\n' +
    "Voir l'explication complète en tête de lib/admin-guard.ts.",
);
process.exit(1);
