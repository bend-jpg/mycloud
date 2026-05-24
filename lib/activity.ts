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
  | "share.download"
  // Team actions (visible dans /family/[teamId]/activity)
  | "team.file.upload"
  | "team.file.version" // nouvelle version d'un fichier existant
  | "team.file.delete"
  | "team.file.move"
  | "team.folder.create"
  | "team.folder.delete"
  | "team.member.join"
  | "team.member.leave"
  | "team.member.invite"
  | "team.member.remove";

/**
 * Enregistre une activité. Throw-safe : on log mais on ne fait jamais planter
 * l'appelant (les actions principales doivent toujours réussir).
 *
 * Extrait l'IP et le User-Agent depuis le Request si fourni.
 * Si teamId est passé, l'action est aussi visible dans l'activité du team.
 */
export async function logActivity(params: {
  userId: string;
  action: ActivityAction;
  teamId?: string | null;
  req?: Request;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { userId, action, teamId, req, metadata } = params;
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
        teamId: teamId ?? null,
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
