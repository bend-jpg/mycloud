// Helper de session : enrobe NextAuth pour exposer un user typé.
// En dev, si aucune session NextAuth + démo activé, retourne le user demo en fallback.

import { auth } from "@/auth";
import { db } from "./db";
import { ensureBootstrap } from "./bootstrap";

const DEV_USER_EMAIL = "demo@mycloud.local";
const DEV_FALLBACK_ENABLED =
  process.env.NODE_ENV === "development" && process.env.MYCLOUD_DISABLE_DEV_USER !== "1";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN" | "STAFF_SUPPORT" | "STAFF_BILLING" | "STAFF_OPS";
  isAdmin: boolean;
  locale: string;
}

export async function getSession(): Promise<SessionUser | null> {
  // 1. NextAuth session
  try {
    const session = await auth();
    if (session?.user?.id) {
      const user = await db.user.findUnique({ where: { id: session.user.id } });
      if (user && !user.suspendedAt) {
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? "User",
          role: user.role,
          isAdmin: user.role === "ADMIN",
          locale: user.locale,
        };
      }
    }
  } catch {
    // ignore — peut arriver si auth() throw sans context (build)
  }

  // 2. Dev fallback : user demo
  if (DEV_FALLBACK_ENABLED) {
    try {
      await ensureBootstrap();
      const user = await db.user.findUnique({ where: { email: DEV_USER_EMAIL } });
      if (user) {
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? "Demo",
          role: user.role,
          isAdmin: user.role === "ADMIN",
          locale: user.locale,
        };
      }
    } catch (e) {
      console.warn("[mycloud] DB indisponible —", e instanceof Error ? e.message : e);
    }
  }

  return null;
}

export async function requireSession(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHORIZED");
  return s;
}

export async function requireAdmin(): Promise<SessionUser> {
  const s = await requireSession();
  if (!s.isAdmin) throw new Error("FORBIDDEN");
  return s;
}
