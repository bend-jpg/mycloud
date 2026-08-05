// Vérification d'adresse email.
//
// À l'inscription, le compte était marqué vérifié immédiatement
// (`emailVerified: new Date()`) : n'importe qui pouvait donc s'inscrire avec
// l'adresse d'un tiers (usurpation), et rien n'empêchait la création massive
// de comptes jetables — ce qui finit par faire blacklister le domaine
// d'envoi et dégrader la délivrabilité de TOUS les emails du service.
//
// Principe retenu : on n'enferme jamais personne dehors. Si l'envoi d'emails
// n'est pas configuré (isEmailConfigured() faux), les comptes restent
// auto-vérifiés comme avant — sinon les utilisateurs ne pourraient plus
// jamais valider leur adresse.

import crypto from "crypto";
import { db } from "./db";
import { sendEmail, verifyEmailTemplate, isEmailConfigured } from "./email";
import { getAppUrl } from "./url";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

/** La vérification est-elle exigée ? Non si l'on ne sait pas envoyer d'email. */
export function verificationRequired(): boolean {
  return isEmailConfigured();
}

/**
 * Crée un jeton de vérification et envoie l'email correspondant.
 * Silencieux en cas d'échec d'envoi : l'inscription ne doit jamais échouer
 * à cause du fournisseur d'emails (l'utilisateur pourra redemander l'envoi).
 */
export async function sendVerificationEmail(email: string, name: string): Promise<void> {
  if (!isEmailConfigured()) return;

  // Un seul jeton actif par adresse : on nettoie les précédents.
  await db.verificationToken.deleteMany({ where: { identifier: email } }).catch(() => undefined);

  const token = crypto.randomBytes(32).toString("hex");
  await db.verificationToken.create({
    data: { identifier: email, token, expires: new Date(Date.now() + TOKEN_TTL_MS) },
  });

  const verifyUrl = `${getAppUrl()}/api/auth/verify-email?token=${token}`;
  const tpl = verifyEmailTemplate(name, verifyUrl);
  await sendEmail({ to: email, ...tpl }).catch(() => undefined);
}

/**
 * Consomme un jeton et marque l'adresse comme vérifiée.
 * Le jeton est à USAGE UNIQUE : il est supprimé qu'il soit valide ou expiré.
 */
export async function consumeVerificationToken(
  token: string,
): Promise<{ ok: boolean; reason?: "invalid" | "expired" }> {
  const record = await db.verificationToken.findUnique({ where: { token } });
  if (!record) return { ok: false, reason: "invalid" };

  await db.verificationToken.deleteMany({ where: { token } });

  if (record.expires < new Date()) return { ok: false, reason: "expired" };

  await db.user.updateMany({
    where: { email: record.identifier },
    data: { emailVerified: new Date() },
  });
  return { ok: true };
}
