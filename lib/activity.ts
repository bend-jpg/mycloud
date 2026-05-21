// Helper pour journaliser les actions sensibles de l'utilisateur.
// Visible par l'utilisateur lui-même dans /security.

import { db } from "./db";

export type ActivityAction =
  | "login"
  | "login.failed"
  | "logout"
  | "password.change"
  | "email.change"
  | "twofa.enable"
  | "twofa.disable"
  | "passkey.add"
  | "passkey.remove"
  | "account.update"
  | "share.view"
  | "share.download";

/**
 * Enregistre une activité. Throw-safe : on log mais on ne fait jamais planter
 * l'appelant (les actions principales doivent toujours réussir).
 *
 * Extrait l'IP et le User-Agent depuis le Request si fourni.
 */
export async function logActivity(params: {
  userId: string;
  action: ActivityAction;
  req?: Request;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { userId, action, req, metadata } = params;
    let ip: string | null = null;
    let userAgent: string | null = null;
    if (req) {
      ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip") ??
        null;
      userAgent = req.headers.get("user-agent") ?? null;
    }
    await db.activityLog.create({
      data: {
        userId,
        action,
        ip: ip ?? undefined,
        userAgent: userAgent?.slice(0, 500) ?? undefined,
        metadata: metadata as object | undefined,
      },
    });
  } catch (e) {
    console.warn("[activity] échec log:", e instanceof Error ? e.message : e);
  }
}
