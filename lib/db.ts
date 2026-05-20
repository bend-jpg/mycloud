import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

// Sur Vercel serverless : chaque invocation a 1 seule requête concurrente
// → connection_limit=1 évite d'épuiser le pool Neon.
// Le pooler Neon (URL avec `-pooler.`) gère le partage entre instances.
function ensureServerlessUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  if (url.includes("connection_limit=")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connection_limit=1`;
}

export const db =
  globalThis.prisma ??
  new PrismaClient({
    datasources: {
      db: { url: ensureServerlessUrl(process.env.DATABASE_URL) },
    },
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalThis.prisma = db;
