// TOTP (Google Authenticator, Authy, 1Password...) — RFC 6238
import { authenticator } from "otplib";
import QRCode from "qrcode";

authenticator.options = {
  window: 1,    // Tolère ±30s de dérive (1 step de 30s)
  step: 30,
  digits: 6,
};

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function getTotpUri(email: string, secret: string, issuer = "MyTitanCloud"): string {
  return authenticator.keyuri(email, issuer, secret);
}

export async function getTotpQrCodeDataUrl(email: string, secret: string, issuer = "MyTitanCloud"): Promise<string> {
  const uri = getTotpUri(email, secret, issuer);
  return QRCode.toDataURL(uri, { errorCorrectionLevel: "M", width: 240, margin: 1 });
}

export function verifyTotpCode(code: string, secret: string): boolean {
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) return false;
  try {
    return authenticator.verify({ token: code, secret });
  } catch {
    return false;
  }
}

/** Génère 10 codes de secours (16 caractères, format XXXX-XXXX-XXXX-XXXX) */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 36).toString(36).toUpperCase()
    ).join("");
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`);
  }
  return codes;
}
