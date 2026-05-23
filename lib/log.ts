// Logger structuré minimal — JSON sur Vercel (parsable par Vercel Logs UI),
// texte lisible en local. Pas de dépendance externe.
//
// Usage :
//   import { log } from "@/lib/log";
//   log.info("user.signup", { userId, plan: "starter" });
//   log.error("stripe.checkout_failed", { userId, error: e.message });
//   log.warn("storage.quota_warning", { userId, pct: 95 });

type Level = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

const IS_PROD = process.env.NODE_ENV === "production";
const IS_VERCEL = !!process.env.VERCEL;

/** Sérialise une valeur en évitant les BigInt et circular refs. */
function serialize(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[Max depth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (Array.isArray(value)) return value.map((v) => serialize(v, depth + 1));
  if (typeof value === "object") {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      obj[k] = serialize(v, depth + 1);
    }
    return obj;
  }
  return value;
}

function emit(level: Level, message: string, context?: LogContext) {
  const entry = {
    level,
    msg: message,
    ts: new Date().toISOString(),
    ...(context ? (serialize(context) as Record<string, unknown>) : {}),
  };
  // En prod Vercel : on émet du JSON sur stdout/stderr (parsable par Vercel Logs)
  if (IS_VERCEL || IS_PROD) {
    const line = JSON.stringify(entry);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    return;
  }
  // En local : on garde un format lisible
  const tag =
    level === "error" ? "❌" : level === "warn" ? "⚠️ " : level === "info" ? "ℹ️ " : "🔍";
  const ctx = context ? " " + JSON.stringify(serialize(context)) : "";
  // eslint-disable-next-line no-console
  console[level === "debug" ? "log" : level](`${tag} ${message}${ctx}`);
}

export const log = {
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
};

/** Extrait userId/ip/ua d'une Request pour le logging. */
export function reqContext(req: Request, extras?: LogContext): LogContext {
  return {
    ip:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null,
    userAgent: req.headers.get("user-agent") ?? null,
    method: req.method,
    url: req.url,
    ...extras,
  };
}
