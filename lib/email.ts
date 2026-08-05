// Envoi d'emails transactionnels via Resend (optionnel — pas d'env vars = no-op).
import { Resend } from "resend";
import { getAppUrl } from "./url";

let cached: Resend | null = null;

export function isEmailConfigured(): boolean {
  return !!process.env.AUTH_RESEND_KEY || !!process.env.RESEND_API_KEY;
}

function getResend(): Resend | null {
  if (!isEmailConfigured()) return null;
  if (cached) return cached;
  const key = (process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY) as string;
  cached = new Resend(key);
  return cached;
}

const FROM = process.env.EMAIL_FROM ?? "MyTitanCloud <noreply@mytitancloud.com>";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] Resend non configuré, email ignoré :", params.subject);
    return { ok: false, error: "EMAIL_NOT_CONFIGURED" };
  }
  try {
    const res = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text ?? stripHtml(params.html),
    });
    if (res.error) {
      console.error("[email] Resend error:", res.error);
      return { ok: false, error: res.error.message };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] exception:", e);
    return { ok: false, error: e instanceof Error ? e.message : "UNKNOWN" };
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// ============================================================
// TEMPLATES (HTML inliné — Resend ne fait pas de templating)
// ============================================================

function baseLayout(content: string, ctaLabel?: string, ctaUrl?: string): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>MyTitanCloud</title></head>
<body style="margin:0;padding:24px;background:#0a0a14;color:#f5f5f7;font-family:-apple-system,Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#14141f;border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.08);">
    <div style="font-size:20px;font-weight:600;margin-bottom:24px;">
      <span style="color:#38bdf8;">☁</span> MyTitanCloud
    </div>
    ${content}
    ${ctaLabel && ctaUrl ? `
      <div style="margin-top:24px;">
        <a href="${ctaUrl}" style="display:inline-block;background:#38bdf8;color:#0a0a14;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;">
          ${ctaLabel}
        </a>
      </div>
    ` : ""}
    <p style="margin-top:32px;font-size:12px;color:#a1a1aa;border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;">
      Tu reçois cet email parce que tu as un compte MyTitanCloud. Si ce n'est pas toi, ignore.
    </p>
  </div>
</body></html>`;
}

export function welcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: "Bienvenue sur MyTitanCloud 🎉",
    html: baseLayout(
      `<h1 style="font-size:22px;margin:0 0 12px;">Bienvenue ${name} !</h1>
      <p style="color:#a1a1aa;line-height:1.6;">
        Ton compte MyTitanCloud est prêt. Tu as 50 Go de stockage gratuit pour commencer,
        un espace famille en bonus si tu upgrades, et la possibilité de partager n'importe
        quel fichier en un clic avec date d'expiration.
      </p>
      <p style="color:#a1a1aa;line-height:1.6;">
        Pense à activer la 2FA dans tes paramètres pour sécuriser ton compte.
      </p>`,
      "Ouvrir mon espace",
      `${getAppUrl()}/dashboard`
    ),
  };
}

/** Email de confirmation d'adresse envoyé à l'inscription. */
export function verifyEmailTemplate(name: string, verifyUrl: string): { subject: string; html: string } {
  return {
    subject: "Confirme ton adresse email — MyTitanCloud",
    html: baseLayout(
      `<h1 style="font-size:22px;margin:0 0 12px;">Bonjour ${name},</h1>
      <p style="color:#a1a1aa;line-height:1.6;">
        Il ne reste qu'une étape : confirme que cette adresse email est bien la tienne
        pour activer complètement ton espace MyTitanCloud.
      </p>
      <p style="color:#a1a1aa;line-height:1.6;">
        Ce lien est valable 24 heures. Si tu n'es pas à l'origine de cette inscription,
        ignore simplement ce message — aucun compte ne sera activé avec ton adresse.
      </p>`,
      "Confirmer mon adresse",
      verifyUrl
    ),
  };
}

export function inviteEmail(
  teamName: string,
  inviterName: string,
  role: string,
  inviteUrl: string
): { subject: string; html: string } {
  const roleLabel = role === "VIEWER" ? "lecture" : role === "EDITOR" ? "édition" : "admin";
  return {
    subject: `${inviterName} t'invite à rejoindre ${teamName} sur MyTitanCloud`,
    html: baseLayout(
      `<h1 style="font-size:22px;margin:0 0 12px;">Invitation à rejoindre ${teamName}</h1>
      <p style="color:#a1a1aa;line-height:1.6;">
        <strong style="color:#f5f5f7;">${inviterName}</strong> t'invite à rejoindre l'espace
        partagé <strong style="color:#f5f5f7;">${teamName}</strong> en tant que
        <span style="color:#38bdf8;">${roleLabel}</span>.
      </p>
      <p style="color:#a1a1aa;line-height:1.6;">
        Une fois accepté, tu verras tous les fichiers partagés dans cet espace.
        Le lien expire dans 7 jours.
      </p>`,
      "Accepter l'invitation",
      inviteUrl
    ),
  };
}

export function shareDownloadedEmail(
  fileName: string,
  shareUrl: string
): { subject: string; html: string } {
  return {
    subject: `📥 Ton fichier "${fileName}" a été téléchargé`,
    html: baseLayout(
      `<h1 style="font-size:22px;margin:0 0 12px;">Quelqu'un a téléchargé ton fichier</h1>
      <p style="color:#a1a1aa;line-height:1.6;">
        Le fichier <strong style="color:#f5f5f7;">${fileName}</strong> que tu as partagé
        vient d'être téléchargé.
      </p>`,
      "Voir mes partages",
      `${getAppUrl()}/shares`
    ),
  };
}

export function ticketReplyEmail(
  ticketNumber: number,
  subject: string,
  message: string,
  ticketUrl: string
): { subject: string; html: string } {
  return {
    subject: `Réponse à ton ticket #${ticketNumber} : ${subject}`,
    html: baseLayout(
      `<h1 style="font-size:22px;margin:0 0 12px;">Notre équipe t'a répondu</h1>
      <p style="color:#a1a1aa;line-height:1.6;">
        Ticket <strong>#${ticketNumber}</strong> — ${subject}
      </p>
      <div style="background:#1a1a28;border-radius:12px;padding:16px;margin-top:12px;color:#f5f5f7;font-style:italic;line-height:1.5;">
        ${message.replace(/\n/g, "<br>")}
      </div>`,
      "Voir le ticket",
      ticketUrl
    ),
  };
}
