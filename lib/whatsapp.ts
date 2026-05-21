// Envoi de messages WhatsApp via Meta Cloud API.
// Pas-d'env-pas-d'envoi : si WHATSAPP_CLOUD_API_TOKEN et
// WHATSAPP_PHONE_NUMBER_ID ne sont pas configurés, isWhatsappConfigured()
// retourne false et sendWhatsapp() est un no-op.
//
// Pour activer :
//   1. Crée une app WhatsApp Business → https://developers.facebook.com/apps
//   2. Récupère le Phone Number ID + l'access token permanent (system user)
//   3. Ajoute dans .env :
//        WHATSAPP_CLOUD_API_TOKEN=EAAGm...
//        WHATSAPP_PHONE_NUMBER_ID=123456789012345
//   4. Crée un template approuvé par Meta pour les notifications transactionnelles
//      (sinon tu ne peux envoyer qu'en répondant à un message reçu < 24h)

export function isWhatsappConfigured(): boolean {
  return !!(process.env.WHATSAPP_CLOUD_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

interface SendWhatsappResult {
  ok: boolean;
  error?: string;
  messageId?: string;
}

/**
 * Envoie un message texte simple. Le destinataire doit avoir initié la conversation
 * dans les dernières 24h, sinon Meta refuse (utiliser un template approuvé pour les
 * notifications transactionnelles).
 *
 * @param to   Numéro au format E.164 (+33612345678) ou avec country code (33612345678)
 * @param body Texte (max 1024 chars Meta)
 */
export async function sendWhatsappText(to: string, body: string): Promise<SendWhatsappResult> {
  if (!isWhatsappConfigured()) {
    return { ok: false, error: "NOT_CONFIGURED" };
  }
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN!;
  // Normalise : retire +, espaces, tirets
  const normalized = to.replace(/[^\d]/g, "");

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalized,
        type: "text",
        text: { preview_url: true, body: body.slice(0, 1024) },
      }),
    });
    const data = (await res.json()) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!res.ok) {
      console.warn("[whatsapp] échec:", data.error?.message);
      return { ok: false, error: data.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, messageId: data.messages?.[0]?.id };
  } catch (e) {
    console.warn("[whatsapp] exception:", e instanceof Error ? e.message : e);
    return { ok: false, error: e instanceof Error ? e.message : "UNKNOWN" };
  }
}

/**
 * Variante template : utilise un template approuvé par Meta. Indispensable pour
 * notifier un user qui n'a pas écrit dans les 24h.
 */
export async function sendWhatsappTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  components: Array<{ type: string; parameters: Array<{ type: string; text: string }> }>,
): Promise<SendWhatsappResult> {
  if (!isWhatsappConfigured()) return { ok: false, error: "NOT_CONFIGURED" };
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN!;
  const normalized = to.replace(/[^\d]/g, "");

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalized,
        type: "template",
        template: { name: templateName, language: { code: languageCode }, components },
      }),
    });
    const data = (await res.json()) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!res.ok) return { ok: false, error: data.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, messageId: data.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "UNKNOWN" };
  }
}
