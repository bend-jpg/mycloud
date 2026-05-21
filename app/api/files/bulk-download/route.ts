// Téléchargement d'une sélection de fichiers en un seul .zip.
// POST { fileIds: string[] } → renvoie un stream zip.
//
// Sécurité : on vérifie que chaque fichier est lisible par l'utilisateur
// (owner OU membre du team avec rôle lecture OU admin).
//
// Limites pour ne pas OOM Vercel serverless :
//   - 100 fichiers max par appel
//   - 2 GB total max
//   - timeout 60s (le maxDuration est fixé via la config Vercel)

import { NextResponse } from "next/server";
import { zip as zipAsync, type Zippable } from "fflate";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { getMembership, canRead } from "@/lib/teams";

const MAX_FILES = 100;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

export const maxDuration = 60; // Vercel : max 60s (Hobby) / 300s (Pro)

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const fileIds: unknown = body?.fileIds;
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    return NextResponse.json({ error: "NO_FILES" }, { status: 400 });
  }
  if (fileIds.length > MAX_FILES) {
    return NextResponse.json(
      { error: "TOO_MANY", message: `Max ${MAX_FILES} fichiers par téléchargement.` },
      { status: 400 },
    );
  }

  // Récupère les fichiers + vérifie accès
  const files = await db.file.findMany({
    where: { id: { in: fileIds as string[] }, isTrash: false },
    select: {
      id: true,
      name: true,
      size: true,
      ownerId: true,
      teamId: true,
      storageKey: true,
      storageBackendId: true,
    },
  });

  if (files.length === 0) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Vérif quota total
  const totalSize = files.reduce((sum, f) => sum + Number(f.size), 0);
  if (totalSize > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { error: "TOO_LARGE", message: "Sélection trop volumineuse (max 2 Go)." },
      { status: 413 },
    );
  }

  // Vérif accès fichier par fichier
  for (const f of files) {
    let allowed = f.ownerId === session.id;
    if (!allowed && f.teamId) {
      const m = await getMembership(f.teamId, session.id);
      allowed = !!m && canRead(m.role);
    }
    if (!allowed && session.isAdmin) allowed = true;
    if (!allowed) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: `Pas d'accès au fichier ${f.id}` },
        { status: 403 },
      );
    }
  }

  // Télécharge tous les blobs en parallèle
  // On déduplique par storageKey pour économiser : 2 fichiers partageant le même blob
  // (cas du partage famille) ne sont téléchargés qu'une fois.
  const uniqueByKey = new Map<string, { backendId: string; key: string; buffer?: Uint8Array }>();
  for (const f of files) {
    const k = `${f.storageBackendId}::${f.storageKey}`;
    if (!uniqueByKey.has(k)) uniqueByKey.set(k, { backendId: f.storageBackendId, key: f.storageKey });
  }

  await Promise.all(
    Array.from(uniqueByKey.entries()).map(async ([k, info]) => {
      const storage = await getStorage(info.backendId);
      const presigned = await storage.createPresignedDownload(info.key, undefined, 300);
      const res = await fetch(presigned.url);
      if (!res.ok) {
        throw new Error(`R2 fetch failed for ${k}: ${res.status}`);
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      uniqueByKey.get(k)!.buffer = buf;
    }),
  );

  // Construit l'arbo du zip — gère les doublons de nom en suffixant (1), (2)...
  const usedNames = new Set<string>();
  const tree: Zippable = {};
  for (const f of files) {
    const safe = sanitize(f.name);
    let candidate = safe;
    let i = 1;
    while (usedNames.has(candidate)) {
      const dot = safe.lastIndexOf(".");
      candidate = dot > 0 ? `${safe.slice(0, dot)} (${i})${safe.slice(dot)}` : `${safe} (${i})`;
      i++;
    }
    usedNames.add(candidate);
    const buf = uniqueByKey.get(`${f.storageBackendId}::${f.storageKey}`)!.buffer!;
    // Stocker non-compressé pour les fichiers déjà compressés (images, vidéos)
    tree[candidate] = [buf, { level: 0 }];
  }

  // Génère le zip (en mémoire — limité par MAX_TOTAL_BYTES)
  const zipped: Uint8Array = await new Promise((resolve, reject) => {
    zipAsync(tree, { level: 0 }, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  const filename = `mytitancloud-${stamp}.zip`;

  // Cast Uint8Array → ArrayBuffer (Response veut un BodyInit) via .buffer
  const body2 = zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;

  return new Response(body2, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(zipped.byteLength),
    },
  });
}

function sanitize(name: string): string {
  return name.replace(/[<>:"|?*\x00-\x1f]/g, "_").slice(0, 200);
}
