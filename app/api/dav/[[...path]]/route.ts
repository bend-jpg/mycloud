// Serveur WebDAV V1 (lecture seule) pour monter MyTitanCloud comme disque réseau.
//
// Configuration côté client :
//   - macOS Finder : Aller → Se connecter au serveur → https://mytitancloud.com/api/dav
//   - Windows : "Connecter un lecteur réseau" → \\mytitancloud.com\api\dav
//   - Linux : davfs2 mount https://mytitancloud.com/api/dav /mnt/mytitancloud
//   - iOS / Android : apps Documents (Readdle), Solid Explorer, CloudMounter…
//
// Auth : HTTP Basic avec ton email + mot de passe MyTitanCloud.
//
// V1 supporte : OPTIONS, PROPFIND (Depth 0/1), GET (redirect signed URL), HEAD.
// V2 ajoutera : PUT, DELETE, MKCOL, MOVE, COPY.

import { db } from "@/lib/db";
import { authBasic, unauthorized, buildPropfindXml, encodePath, normalizePath } from "@/lib/webdav";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Méthodes acceptées par la spec WebDAV qu'on supporte
const ALLOWED_METHODS = "OPTIONS, PROPFIND, GET, HEAD";

async function handler(req: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const method = req.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        Allow: ALLOWED_METHODS,
        DAV: "1",
        "Content-Length": "0",
      },
    });
  }

  const auth = await authBasic(req);
  if (!auth) return unauthorized();

  const { path: rawPath } = await params;
  const pathSegments = normalizePath(rawPath);

  // Trouve l'emplacement dans l'arborescence du user
  const target = await resolvePath(auth.userId, pathSegments);
  if (!target) return new Response("Not Found", { status: 404 });

  if (method === "PROPFIND") return handlePropfind(req, auth.userId, target);
  if (method === "GET" || method === "HEAD") return handleGet(req, target, method === "HEAD");

  return new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: ALLOWED_METHODS },
  });
}

export {
  handler as GET,
  handler as HEAD,
  handler as OPTIONS,
};

// Next.js ne permet pas d'exporter directement PROPFIND. On utilise un fallback:
// Next.js 14+ supporte les méthodes HTTP arbitraires via un export nommé.
// PROPFIND est une méthode non-standard donc on doit la mapper.
// → Solution : on déclare aussi PROPFIND comme export (les versions récentes l'acceptent).
export async function PROPFIND(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return handler(req, ctx);
}

// ============================================================
// Résolution d'un chemin → racine | folder | file du user
// ============================================================
interface ResolvedRoot {
  type: "root";
}
interface ResolvedFolder {
  type: "folder";
  id: string;
  name: string;
  updatedAt: Date;
}
interface ResolvedFile {
  type: "file";
  id: string;
  name: string;
  size: bigint;
  mimeType: string;
  uploadedAt: Date;
  storageKey: string;
  storageBackendId: string;
}
type Resolved = ResolvedRoot | ResolvedFolder | ResolvedFile;

async function resolvePath(userId: string, segments: string[]): Promise<Resolved | null> {
  if (segments.length === 0) return { type: "root" };

  // On descend segment par segment depuis la racine
  let parentId: string | null = null;
  for (let i = 0; i < segments.length; i++) {
    const name = segments[i];
    const isLast = i === segments.length - 1;
    // Dossier d'abord
    const folder: { id: string; name: string; updatedAt: Date } | null =
      await db.folder.findFirst({
        where: { ownerId: userId, parentId, name, isTrash: false, teamId: null },
        select: { id: true, name: true, updatedAt: true },
      });
    if (folder) {
      if (isLast) return { type: "folder", ...folder };
      parentId = folder.id;
      continue;
    }
    // Si pas de dossier ET dernier segment → essayer fichier
    if (isLast) {
      const file = await db.file.findFirst({
        where: { ownerId: userId, folderId: parentId, name, isTrash: false, teamId: null },
        select: {
          id: true,
          name: true,
          size: true,
          mimeType: true,
          uploadedAt: true,
          storageKey: true,
          storageBackendId: true,
        },
      });
      if (file) return { type: "file", ...file };
    }
    return null;
  }
  return null;
}

// ============================================================
// PROPFIND — listing
// ============================================================
async function handlePropfind(req: Request, userId: string, target: Resolved): Promise<Response> {
  const depth = req.headers.get("depth") ?? "1";
  const url = new URL(req.url);
  // Base href = chemin demandé (pour construire les hrefs enfants)
  const basePath = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;

  const items: Parameters<typeof buildPropfindXml>[0] = [];

  // 1. Auto-description du target
  if (target.type === "root") {
    items.push({
      href: basePath + "/",
      displayName: "MyTitanCloud",
      isCollection: true,
    });
  } else if (target.type === "folder") {
    items.push({
      href: basePath + "/",
      displayName: target.name,
      isCollection: true,
      lastModified: target.updatedAt,
    });
  } else {
    items.push({
      href: basePath,
      displayName: target.name,
      isCollection: false,
      contentLength: Number(target.size),
      contentType: target.mimeType,
      lastModified: target.uploadedAt,
    });
  }

  // 2. Enfants si depth >= 1 ET target = root/folder
  if (depth !== "0" && (target.type === "root" || target.type === "folder")) {
    const folderId = target.type === "root" ? null : target.id;
    const [folders, files] = await Promise.all([
      db.folder.findMany({
        where: { ownerId: userId, parentId: folderId, isTrash: false, teamId: null },
        select: { id: true, name: true, updatedAt: true },
        orderBy: { name: "asc" },
      }),
      db.file.findMany({
        where: { ownerId: userId, folderId, isTrash: false, teamId: null },
        select: { name: true, size: true, mimeType: true, uploadedAt: true },
        orderBy: { name: "asc" },
      }),
    ]);
    for (const f of folders) {
      items.push({
        href: basePath + encodePath([f.name]) + "/",
        displayName: f.name,
        isCollection: true,
        lastModified: f.updatedAt,
      });
    }
    for (const f of files) {
      items.push({
        href: basePath + encodePath([f.name]),
        displayName: f.name,
        isCollection: false,
        contentLength: Number(f.size),
        contentType: f.mimeType,
        lastModified: f.uploadedAt,
      });
    }
  }

  const xml = buildPropfindXml(items);
  return new Response(xml, {
    status: 207, // Multi-Status
    headers: {
      "Content-Type": 'application/xml; charset="utf-8"',
      DAV: "1",
    },
  });
}

// ============================================================
// GET / HEAD — télécharge le fichier
// ============================================================
async function handleGet(_req: Request, target: Resolved, headOnly: boolean): Promise<Response> {
  if (target.type !== "file") {
    return new Response("Not a file", { status: 400 });
  }
  if (headOnly) {
    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": target.mimeType,
        "Content-Length": String(target.size),
      },
    });
  }
  const storage = await getStorage(target.storageBackendId);
  const presigned = await storage.createPresignedDownload(target.storageKey, undefined, 600);
  // Redirect 302 vers signed URL — le client WebDAV suit la redirection
  return Response.redirect(presigned.url, 302);
}
