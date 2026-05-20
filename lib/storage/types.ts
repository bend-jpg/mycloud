// Interface unifiée pour tout fournisseur de stockage objet.
// Permet de brancher R2, S3, B2, MinIO, NAS perso, etc. sans changer le reste du code.

export interface UploadOptions {
  contentType?: string;
  contentLength?: number;
  metadata?: Record<string, string>;
}

export interface PresignedUpload {
  url: string;
  method: "PUT" | "POST";
  headers?: Record<string, string>;
  fields?: Record<string, string>; // pour POST multipart
  key: string;
  expiresAt: Date;
}

export interface PresignedDownload {
  url: string;
  expiresAt: Date;
}

export interface MultipartInit {
  uploadId: string;
  key: string;
}

export interface MultipartPartUrl {
  partNumber: number;
  url: string;
  expiresAt: Date;
}

export interface MultipartComplete {
  partNumber: number;
  etag: string;
}

export interface StorageObjectInfo {
  key: string;
  size: number;
  lastModified: Date;
  etag?: string;
  contentType?: string;
}

export interface StorageProvider {
  readonly id: string;
  readonly name: string;

  // Uploads simples (petits fichiers <100Mo idéalement)
  putObject(key: string, body: Buffer | Uint8Array, options?: UploadOptions): Promise<void>;

  // Upload par presigned URL (le navigateur upload direct, on évite Vercel)
  createPresignedUpload(key: string, options?: UploadOptions, expiresInSeconds?: number): Promise<PresignedUpload>;

  // Multipart pour gros fichiers (films, etc.)
  initMultipartUpload(key: string, options?: UploadOptions): Promise<MultipartInit>;
  createPresignedUploadPart(key: string, uploadId: string, partNumber: number, expiresInSeconds?: number): Promise<MultipartPartUrl>;
  completeMultipartUpload(key: string, uploadId: string, parts: MultipartComplete[]): Promise<void>;
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;

  // Download
  createPresignedDownload(key: string, fileName?: string, expiresInSeconds?: number): Promise<PresignedDownload>;
  getObject(key: string): Promise<Buffer>;

  // Gestion
  deleteObject(key: string): Promise<void>;
  deleteObjects(keys: string[]): Promise<void>;
  headObject(key: string): Promise<StorageObjectInfo | null>;
  copyObject(sourceKey: string, destKey: string): Promise<void>;
}

export type StorageProviderType = "LOCAL" | "R2" | "S3" | "B2" | "MINIO" | "WASABI" | "CUSTOM_S3";

export interface StorageBackendConfig {
  id: string;
  name: string;
  type: StorageProviderType;
  endpoint?: string;
  region?: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl?: string;
}
