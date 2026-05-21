// Helpers WebDAV : auth HTTP Basic, génération XML PROPFIND, parsing path.

import bcrypt from "bcryptjs";
import { db } from "./db";

/**
 * Authentifie une requête WebDAV via HTTP Basic.
 * Header format : Authorization: Basic base64(email:password)
 * Retourne le userId si OK, null sinon.
 */
export async function authBasic(req: Request): Promise<{ userId: string } | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return null;
  let decoded: string;
  try {
    decoded = atob(auth.slice(6).trim());
  } catch {
    return null;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return null;
  const email = decoded.slice(0, idx).toLowerCase().trim();
  const password = decoded.slice(idx + 1);

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, suspendedAt: true },
  });
  if (!user || user.suspendedAt || !user.passwordHash) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return { userId: user.id };
}

/** Renvoie la réponse 401 standard avec WWW-Authenticate. */
export function unauthorized(): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="MyTitanCloud WebDAV"',
      "Content-Type": "text/plain",
    },
  });
}

/**
 * Échappe un chemin pour l'inclure dans un href XML.
 * Encode chaque segment avec encodeURIComponent.
 */
export function encodePath(segments: string[]): string {
  return "/" + segments.map((s) => encodeURIComponent(s)).join("/");
}

/** Génère un PROPFIND multistatus XML pour une liste d'items. */
export function buildPropfindXml(
  items: Array<{
    href: string;
    displayName: string;
    isCollection: boolean;
    contentLength?: number;
    contentType?: string;
    lastModified?: Date;
  }>,
): string {
  const responses = items
    .map((it) => {
      const propXml = it.isCollection
        ? `
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:getcontentlength>0</D:getcontentlength>`
        : `
        <D:resourcetype/>
        <D:getcontentlength>${it.contentLength ?? 0}</D:getcontentlength>
        <D:getcontenttype>${escapeXml(it.contentType ?? "application/octet-stream")}</D:getcontenttype>`;
      const modified = it.lastModified
        ? `<D:getlastmodified>${it.lastModified.toUTCString()}</D:getlastmodified>`
        : "";
      return `<D:response>
    <D:href>${escapeXml(it.href)}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(it.displayName)}</D:displayname>
        ${propXml}
        ${modified}
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<D:multistatus xmlns:D="DAV:">
${responses}
</D:multistatus>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Normalise un path WebDAV. "" → "/", "foo/bar/" → "/foo/bar" */
export function normalizePath(parts: string[] | undefined): string[] {
  if (!parts) return [];
  return parts.map((p) => decodeURIComponent(p)).filter((p) => p && p !== ".");
}
