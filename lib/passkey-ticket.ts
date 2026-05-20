// Ticket éphémère (HMAC-SHA256) prouvant qu'une assertion passkey a été vérifiée.
// Le serveur passe ce ticket au provider NextAuth "passkey" pour finaliser le login.
import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET ?? "dev-passkey-secret";

export function signPasskeyTicket(userId: string, expiresAt: number): string {
  const payload = `${userId}|${expiresAt}`;
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}|${sig}`).toString("base64url");
}

export function verifyPasskeyTicket(ticket: string): string | null {
  try {
    const decoded = Buffer.from(ticket, "base64url").toString("utf8");
    const [userId, expiresAtStr, sig] = decoded.split("|");
    if (!userId || !expiresAtStr || !sig) return null;
    const expected = crypto.createHmac("sha256", SECRET).update(`${userId}|${expiresAtStr}`).digest("hex");
    if (sig !== expected) return null;
    if (Date.now() > parseInt(expiresAtStr, 10)) return null;
    return userId;
  } catch {
    return null;
  }
}
