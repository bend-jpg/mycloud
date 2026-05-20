// Implémentation S3-compatible (couvre R2, AWS S3, B2, MinIO, Wasabi, custom).
// Une seule classe parce que tous ces fournisseurs parlent la même API.

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  StorageProvider,
  StorageBackendConfig,
  PresignedUpload,
  PresignedDownload,
  MultipartInit,
  MultipartPartUrl,
  MultipartComplete,
  StorageObjectInfo,
  UploadOptions,
} from "./types";

export class S3CompatibleProvider implements StorageProvider {
  readonly id: string;
  readonly name: string;
  private client: S3Client;
  private bucket: string;
  private publicUrl?: string;

  constructor(config: StorageBackendConfig) {
    this.id = config.id;
    this.name = config.name;
    this.bucket = config.bucket;
    this.publicUrl = config.publicUrl;

    this.client = new S3Client({
      region: config.region ?? "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.type === "MINIO" || config.type === "CUSTOM_S3",
    });
  }

  async putObject(key: string, body: Buffer | Uint8Array, options?: UploadOptions): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: options?.contentType,
        ContentLength: options?.contentLength,
        Metadata: options?.metadata,
      })
    );
  }

  async createPresignedUpload(
    key: string,
    options?: UploadOptions,
    expiresInSeconds = 3600
  ): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: options?.contentType,
      Metadata: options?.metadata,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    return {
      url,
      method: "PUT",
      headers: options?.contentType ? { "Content-Type": options.contentType } : undefined,
      key,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async initMultipartUpload(key: string, options?: UploadOptions): Promise<MultipartInit> {
    const res = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: options?.contentType,
        Metadata: options?.metadata,
      })
    );
    if (!res.UploadId) throw new Error("No UploadId returned");
    return { uploadId: res.UploadId, key };
  }

  async createPresignedUploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresInSeconds = 3600
  ): Promise<MultipartPartUrl> {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    return {
      partNumber,
      url,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async completeMultipartUpload(key: string, uploadId: string, parts: MultipartComplete[]): Promise<void> {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
        },
      })
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      })
    );
  }

  async createPresignedDownload(key: string, fileName?: string, expiresInSeconds = 3600): Promise<PresignedDownload> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: fileName ? `attachment; filename="${encodeURIComponent(fileName)}"` : undefined,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    return { url, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) };
  }

  async getObject(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!res.Body) throw new Error("Empty body");
    const chunks: Uint8Array[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async deleteObjects(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })) },
        })
      );
    }
  }

  async headObject(key: string): Promise<StorageObjectInfo | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        key,
        size: Number(res.ContentLength ?? 0),
        lastModified: res.LastModified ?? new Date(),
        etag: res.ETag,
        contentType: res.ContentType,
      };
    } catch (e: unknown) {
      const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) return null;
      throw e;
    }
  }

  async copyObject(sourceKey: string, destKey: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: destKey,
        CopySource: `${this.bucket}/${sourceKey}`,
      })
    );
  }
}
