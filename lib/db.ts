import { PrismaClient } from "@prisma/client";
import { hideIncompleteUploads } from "./db-filters";

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

  // Voir lib/db-filters.ts : le filtre y est isolé et testé, parce qu'une
  // erreur dedans se manifeste très loin de sa cause.
  return base.$extends({
    name: "hide-incomplete-uploads",
    query: {
      file: {
        findMany({ args, query }) {
          return query(hideIncompleteUploads(args));
        },
        findFirst({ args, query }) {
          return query(hideIncompleteUploads(args));
        },
        count({ args, query }) {
          return query(hideIncompleteUploads(args));
        },
        aggregate({ args, query }) {
          return query(hideIncompleteUploads(args));
        },
        groupBy({ args, query }) {
          return query(hideIncompleteUploads(args));
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
