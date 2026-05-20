// Factory + registry des storage backends.
// Le code applicatif appelle `getStorage()` ou `getDefaultStorage()`,
// le backend physique est résolu en DB.

import { db } from "@/lib/db";
import { S3CompatibleProvider } from "./s3-compatible";
import { LocalProvider } from "./local";
import type { StorageProvider, StorageBackendConfig } from "./types";

const cache = new Map<string, StorageProvider>();

function buildProvider(config: StorageBackendConfig): StorageProvider {
  switch (config.type) {
    case "LOCAL":
      return new LocalProvider(config);
    case "R2":
    case "S3":
    case "B2":
    case "MINIO":
    case "WASABI":
    case "CUSTOM_S3":
      return new S3CompatibleProvider(config);
    default: {
      const exhaustive: never = config.type;
      throw new Error(`Unsupported storage type: ${exhaustive}`);
    }
  }
}

export async function getStorage(backendId: string): Promise<StorageProvider> {
  const hit = cache.get(backendId);
  if (hit) return hit;

  const row = await db.storageBackend.findUnique({ where: { id: backendId } });
  if (!row) throw new Error(`Storage backend not found: ${backendId}`);
  if (!row.isActive) throw new Error(`Storage backend disabled: ${backendId}`);

  const provider = buildProvider({
    id: row.id,
    name: row.name,
    type: row.type as StorageBackendConfig["type"],
    endpoint: row.endpoint ?? undefined,
    region: row.region ?? undefined,
    bucket: row.bucket,
    accessKeyId: row.accessKeyId,
    secretAccessKey: row.secretAccessKey,
    publicUrl: row.publicUrl ?? undefined,
  });
  cache.set(backendId, provider);
  return provider;
}

export async function getDefaultStorage(): Promise<{ provider: StorageProvider; backendId: string }> {
  const row = await db.storageBackend.findFirst({
    where: { isDefault: true, isActive: true },
  });
  if (!row) throw new Error("No default storage backend configured");
  const provider = await getStorage(row.id);
  return { provider, backendId: row.id };
}

// Helpers de génération de clés (objets dans le bucket)
export function userFileKey(userId: string, fileId: string, fileName: string): string {
  // On range par utilisateur pour faciliter les purges ; le nom est sanitisé.
  const safe = fileName.replace(/[^\w.\-]/g, "_").slice(0, 200);
  return `u/${userId}/${fileId}/${safe}`;
}

export function teamFileKey(teamId: string, fileId: string, fileName: string): string {
  const safe = fileName.replace(/[^\w.\-]/g, "_").slice(0, 200);
  return `t/${teamId}/${fileId}/${safe}`;
}

export function invalidateStorageCache(backendId?: string): void {
  if (backendId) cache.delete(backendId);
  else cache.clear();
}

export type { StorageProvider } from "./types";
