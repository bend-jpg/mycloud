import { PrismaClient } from "@prisma/client";

// Sur Vercel serverless : chaque invocation a 1 seule requête concurrente
// → connection_limit=1 évite d'épuiser le pool Neon.
// Le pooler Neon (URL avec `-pooler.`) gère le partage entre instances.
function ensureServerlessUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  if (url.includes("connection_limit=")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connection_limit=1`;
}

function createClient() {
  const base = new PrismaClient({
    datasources: {
      db: { url: ensureServerlessUrl(process.env.DATABASE_URL) },
    },
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

  /**
   * ─────────────────────────────────────────────────────────────────────
   * MASQUAGE DES ENVOIS NON TERMINÉS
   * ─────────────────────────────────────────────────────────────────────
   *
   * La ligne File est créée AVANT que les octets soient envoyés : il faut
   * une clé de stockage et une vérification de quota avant de pouvoir
   * signer l'URL d'envoi. Si l'envoi échoue ensuite — réseau coupé, onglet
   * fermé, serveur saturé — la ligne reste.
   *
   * Résultat constaté en production : des fichiers listés dans le cloud dont
   * les octets n'existent nulle part. Les ouvrir affichait « Impossible de
   * charger le contenu », sans que rien n'explique pourquoi.
   *
   * Le filtre est appliqué ICI plutôt que dans chacune des ~50 requêtes de
   * listage réparties dans l'application : un seul oubli suffirait à faire
   * réapparaître ces fichiers fantômes quelque part.
   *
   * Échappatoire volontaire : si l'appelant mentionne explicitement
   * `uploadPending` dans son filtre, on ne touche à rien. C'est ce qui
   * permet à la maintenance de retrouver justement ces lignes pour les
   * supprimer.
   *
   * findUnique n'est pas filtré : Prisma n'y accepte que des champs
   * uniques. Ce n'est pas gênant — le problème concerne les LISTES, et
   * /complete a besoin de retrouver la ligne en attente pour la finaliser.
   */
  const hideIncomplete = <T extends { where?: Record<string, unknown> }>(args: T): T => {
    const where = (args.where ?? {}) as Record<string, unknown>;
    if ("uploadPending" in where) return args; // choix explicite de l'appelant
    return { ...args, where: { ...where, uploadPending: false } };
  };

  return base.$extends({
    name: "hide-incomplete-uploads",
    query: {
      file: {
        findMany({ args, query }) {
          return query(hideIncomplete(args));
        },
        findFirst({ args, query }) {
          return query(hideIncomplete(args));
        },
        count({ args, query }) {
          return query(hideIncomplete(args));
        },
        aggregate({ args, query }) {
          return query(hideIncomplete(args));
        },
        groupBy({ args, query }) {
          return query(hideIncomplete(args));
        },
      },
    },
  });
}

type ExtendedClient = ReturnType<typeof createClient>;

declare global {
  var prisma: ExtendedClient | undefined;
}

export const db = globalThis.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalThis.prisma = db;
