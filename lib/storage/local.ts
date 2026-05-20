// Backend stockage local (filesystem) pour le développement.
// Sur Vercel le filesystem est en lecture seule — utiliser R2 en prod.
// Les "presigned URLs" pointent vers nos propres endpoints /api/files/local-* signés HMAC.

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type {
  StorageProvider,
  PresignedUpload,
  PresignedDownload,
  MultipartInit,
  MultipartPartUrl,
  MultipartComplete,
  StorageObjectInfo,
  UploadOptions,
  StorageBackendConfig,
} from "./types";

const LOCAL_SECRET = process.env.AUTH_SECRET ?? "dev-local-secret-change-me";

function sign(payload: string): string {
  return crypto.createHmac("sha256", LOCAL_SECRET).update(payload).digest("hex");
}

export function signLocalToken(action: "put" | "get", key: string, expiresAt: number): string {
  const payload = `${action}|${key}|${expiresAt}`;
  return Buffer.from(`${payload}|${sign(payload)}`).toString("base64url");
}

export function verifyLocalToken(token: string): { action: string; key: string; expiresAt: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [action, key, expiresAtStr, signature] = decoded.split("|");
    if (!action || !key || !expiresAtStr || !signature) return null;
    const expected = sign(`${action}|${key}|${expiresAtStr}`);
    if (signature !== expected) return null;
    const expiresAt = parseInt(expiresAtStr, 10);
    if (Date.now() > expiresAt) return null;
    return { action, key, expiresAt };
  } catch {
    return null;
  }
}

export class LocalProvider implements StorageProvider {
  readonly id: string;
  readonly name: string;
  private root: string;
  private baseUrl: string;

  constructor(config: StorageBackendConfig & { rootDir?: string }) {
    this.id = config.id;
    this.name = config.name;
    this.root = config.rootDir ?? path.resolve(process.cwd(), ".storage", config.bucket);
    this.baseUrl = config.publicUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  }

  private resolveKey(key: string): string {
    const safe = key.replace(/\.\./g, "_");
    return path.join(this.root, safe);
  }

  async putObject(key: string, body: Buffer | Uint8Array): Promise<void> {
    const full = this.resolveKey(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
  }

  async createPresignedUpload(
    key: string,
    options?: UploadOptions,
    expiresInSeconds = 3600
  ): Promise<PresignedUpload> {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const token = signLocalToken("put", key, expiresAt);
    return {
      url: `${this.baseUrl}/api/files/local-put?token=${encodeURIComponent(token)}`,
      method: "PUT",
      headers: options?.contentType ? { "Content-Type": options.contentType } : undefined,
      key,
      expiresAt: new Date(expiresAt),
    };
  }

  // Multipart non supporté en local — on simule un seul fichier ; le client fera un PUT simple.
  async initMultipartUpload(key: string): Promise<MultipartInit> {
    return { uploadId: "local-single", key };
  }
  async createPresignedUploadPart(): Promise<MultipartPartUrl> {
    throw new Error("Multipart non supporté sur le backend local — utiliser createPresignedUpload");
  }
  async completeMultipartUpload(): Promise<void> {
    // no-op
  }
  async abortMultipartUpload(): Promise<void> {
    // no-op
  }

  async createPresignedDownload(key: string, fileName?: string, expiresInSeconds = 3600): Promise<PresignedDownload> {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const token = signLocalToken("get", key, expiresAt);
    const fn = fileName ? `&name=${encodeURIComponent(fileName)}` : "";
    return {
      url: `${this.baseUrl}/api/files/local-get?token=${encodeURIComponent(token)}${fn}`,
      expiresAt: new Date(expiresAt),
    };
  }

  async getObject(key: string): Promise<Buffer> {
    return fs.readFile(this.resolveKey(key));
  }

  async deleteObject(key: string): Promise<void> {
    await fs.rm(this.resolveKey(key), { force: true });
  }

  async deleteObjects(keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => this.deleteObject(k)));
  }

  async headObject(key: string): Promise<StorageObjectInfo | null> {
    try {
      const stat = await fs.stat(this.resolveKey(key));
      return { key, size: stat.size, lastModified: stat.mtime };
    } catch {
      return null;
    }
  }

  async copyObject(sourceKey: string, destKey: string): Promise<void> {
    const buf = await this.getObject(sourceKey);
    await this.putObject(destKey, buf);
  }
}
