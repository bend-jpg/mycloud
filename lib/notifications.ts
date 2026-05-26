// Helpers pour créer des notifications in-app.
import { db } from "./db";
import type { NotificationType } from "@prisma/client";
import { isChannelEnabled } from "./notification-prefs";

export interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  metadata?: Record<string, unknown>;
  /** Si une notif identique non lue existe déjà, ne pas en créer une nouvelle (dédup) */
  dedupeWindowMs?: number;
  /** Bypass les prefs user (pour ADMIN_ALERT et notifs critiques système) */
  bypassPrefs?: boolean;
}

export async function notify({
  userId,
  type,
  title,
  body,
  link,
  metadata,
  dedupeWindowMs,
  bypassPrefs,
}: NotifyParams): Promise<void> {
  // Vérifie les préférences user pour le canal in-app — sauf si bypass
  if (!bypassPrefs) {
    const wantsInApp = await isChannelEnabled(userId, type, "inApp");
    if (!wantsInApp) return;
  }

  if (dedupeWindowMs && dedupeWindowMs > 0) {
    const existing = await db.notification.findFirst({
      where: {
        userId,
        type,
        title,
        read: false,
        createdAt: { gte: new Date(Date.now() - dedupeWindowMs) },
      },
    });
    if (existing) return;
  }
  await db.notification.create({
    data: { userId, type, title, body: body ?? null, link: link ?? null, metadata: metadata as object | undefined },
  });
}

/** Notifie tous les admins (utile pour alertes système). Bypass les prefs
 *  car ce sont des alertes internes critiques. */
export async function notifyAdmins(params: Omit<NotifyParams, "userId">): Promise<void> {
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await Promise.all(admins.map((a) => notify({ ...params, userId: a.id, bypassPrefs: true })));
}

/** Vérifie le quota d'un user et envoie une notif si dépassement de seuil (80%, 95%, 100%) */
export async function checkQuotaAlert(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { storageUsed: true, storageQuota: true },
  });
  if (!user || user.storageQuota === BigInt(0)) return;
  const ratio = Number(user.storageUsed) / Number(user.storageQuota);
  if (ratio >= 1) {
    await notify({
      userId,
      type: "QUOTA_EXCEEDED",
      title: "Quota de stockage dépassé",
      body: "Tu as dépassé ton quota. Les nouveaux uploads seront refusés. Passe à un plan supérieur ou libère de l'espace.",
      link: "/billing",
      dedupeWindowMs: 24 * 3600_000,
    });
  } else if (ratio >= 0.95) {
    await notify({
      userId,
      type: "QUOTA_WARNING",
      title: "Stockage presque plein (95%)",
      body: "Pense à libérer de l'espace ou à upgrader ton plan.",
      link: "/billing",
      dedupeWindowMs: 24 * 3600_000,
    });
  } else if (ratio >= 0.8) {
    await notify({
      userId,
      type: "QUOTA_WARNING",
      title: "Stockage à 80%",
      body: "Anticipe : il reste 20% d'espace libre.",
      link: "/billing",
      dedupeWindowMs: 7 * 24 * 3600_000,
    });
  }
}
