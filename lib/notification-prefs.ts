// Préférences de notification par type, par canal.
//
// Stocké en JSON sur User.notificationPrefs (pas de table dédiée pour V0 —
// éviter une migration et une jointure pour chaque notif). Structure :
//
//   {
//     "QUOTA_WARNING": { inApp: true, email: true, push: false },
//     "FILES_UPLOADED": { inApp: true, email: false, push: false },
//     ...
//   }
//
// Si une clé est absente, on utilise les défauts ci-dessous. Si l'objet
// entier est null/undefined → tous les défauts s'appliquent.

import { cache } from "react";
import type { NotificationType } from "@prisma/client";
import { db } from "./db";

export type Channel = "inApp" | "email" | "push";

export interface ChannelPrefs {
  inApp: boolean;
  email: boolean;
  push: boolean;
}

export type NotificationPrefs = Partial<Record<NotificationType, ChannelPrefs>>;

// Défauts intelligents : tout in-app activé, email seulement pour les choses
// importantes (paiements, quota, invites), push seulement pour les vraiment
// critiques (quota dépassé, invite famille).
export const DEFAULT_PREFS: Record<NotificationType, ChannelPrefs> = {
  QUOTA_WARNING:     { inApp: true, email: true,  push: false },
  QUOTA_EXCEEDED:    { inApp: true, email: true,  push: true  },
  PAYMENT_FAILED:    { inApp: true, email: true,  push: true  },
  PAYMENT_SUCCEEDED: { inApp: true, email: true,  push: false },
  SHARE_DOWNLOADED:  { inApp: true, email: false, push: false },
  INVITE_ACCEPTED:   { inApp: true, email: true,  push: false },
  INVITE_RECEIVED:   { inApp: true, email: true,  push: true  },
  TICKET_REPLY:      { inApp: true, email: true,  push: true  },
  ADMIN_ALERT:       { inApp: true, email: true,  push: false },
  SYSTEM:            { inApp: true, email: false, push: false },
  FILES_UPLOADED:    { inApp: true, email: false, push: false },
};

// Labels affichés dans l'UI Settings — ordre = ordre d'affichage
export const NOTIFICATION_TYPE_INFO: Array<{
  type: NotificationType;
  label: string;
  description: string;
  importance: "critical" | "important" | "info";
}> = [
  { type: "QUOTA_EXCEEDED",    label: "Quota dépassé",           description: "Ton espace est plein — uploads bloqués.", importance: "critical" },
  { type: "QUOTA_WARNING",     label: "Quota presque atteint",   description: "À 80% ou 95% de ton espace.", importance: "important" },
  { type: "PAYMENT_FAILED",    label: "Paiement échoué",         description: "Une de tes cartes a refusé un paiement.", importance: "critical" },
  { type: "PAYMENT_SUCCEEDED", label: "Paiement confirmé",       description: "Récap quand un paiement est validé.", importance: "info" },
  { type: "INVITE_RECEIVED",   label: "Invitation reçue",        description: "Quelqu'un t'a invité dans son espace famille.", importance: "important" },
  { type: "INVITE_ACCEPTED",   label: "Invitation acceptée",     description: "Quelqu'un a accepté ton invitation famille.", importance: "info" },
  { type: "SHARE_DOWNLOADED",  label: "Téléchargement de tes liens", description: "Quand quelqu'un télécharge un fichier que tu as partagé.", importance: "info" },
  { type: "TICKET_REPLY",      label: "Réponse à tes tickets",   description: "L'équipe support a répondu à ton message.", importance: "important" },
  { type: "FILES_UPLOADED",    label: "Sauvegarde de fichiers",  description: "Récap quand des photos ou fichiers sont sauvegardés (sync auto).", importance: "info" },
  { type: "SYSTEM",            label: "Annonces MyTitanCloud",   description: "Nouvelles fonctionnalités, maintenance prévue, etc.", importance: "info" },
  // ADMIN_ALERT n'est PAS dans la UI utilisateur — c'est interne staff
];

/** Récupère les préférences mergées (defaults + overrides DB) pour un user.
 *  Caché par React.cache : si plusieurs notify() pour le même user au même
 *  render, un seul vrai SELECT. */
export const getUserPrefs = cache(async function getUserPrefs(userId: string): Promise<Record<NotificationType, ChannelPrefs>> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { notificationPrefs: true } });
  return mergeWithDefaults((u?.notificationPrefs as NotificationPrefs | null) ?? {});
});

/** Merge utilisé par l'API et le helper notify — défauts + overrides. */
export function mergeWithDefaults(overrides: NotificationPrefs): Record<NotificationType, ChannelPrefs> {
  const merged = { ...DEFAULT_PREFS };
  for (const [type, prefs] of Object.entries(overrides)) {
    if (!prefs) continue;
    merged[type as NotificationType] = {
      inApp: prefs.inApp ?? DEFAULT_PREFS[type as NotificationType].inApp,
      email: prefs.email ?? DEFAULT_PREFS[type as NotificationType].email,
      push: prefs.push ?? DEFAULT_PREFS[type as NotificationType].push,
    };
  }
  return merged;
}

/** Quick-check : est-ce que le user veut être notifié pour ce type sur ce canal ? */
export async function isChannelEnabled(
  userId: string,
  type: NotificationType,
  channel: Channel,
): Promise<boolean> {
  const prefs = await getUserPrefs(userId);
  return prefs[type]?.[channel] ?? false;
}
