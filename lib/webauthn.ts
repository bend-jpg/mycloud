// WebAuthn / Passkeys — wrapper sur @simplewebauthn/server
import { getAppUrl } from "./url";

export function getRpId(): string {
  const url = new URL(getAppUrl());
  // RP ID = le domaine sans protocole ni port
  return url.hostname;
}

export function getRpOrigin(): string {
  return getAppUrl();
}

export const RP_NAME = "MyCloud";

/** Vérifie qu'on est bien sur un environnement supporté (HTTPS ou localhost) */
export function webauthnAvailable(): boolean {
  const url = getAppUrl();
  return url.startsWith("https://") || url.startsWith("http://localhost");
}
