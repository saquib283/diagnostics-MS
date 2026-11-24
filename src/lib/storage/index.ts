import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

export interface PutPrivateObjectParams {
  storageKey: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface StorageProvider {
  putObject(params: PutPrivateObjectParams): Promise<void>;
  getObjectBuffer(storageKey: string): Promise<Buffer>;
  getSignedDownloadUrl(
    storageKey: string,
    downloadFilename: string,
  ): Promise<string | null>;
}

function assertSafeStorageKey(storageKey: string): string {
  const normalized = storageKey.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.includes("..") ||
    normalized.startsWith(".") ||
    !/^[a-zA-Z0-9/_\-.]+$/.test(normalized)
  ) {
    throw new AppError("BAD_REQUEST", "Invalid private storage key.", 400);
  }
  return normalized;
}

class LocalPrivateStorageAdapter implements StorageProvider {
  private readonly rootDir: string;

  constructor(_dir: string) {
    this.rootDir = path.join(process.cwd(), ".private-storage");
  }

  private resolveSafePath(storageKey: string): string {
    const cleanKey = assertSafeStorageKey(storageKey);
    const fullPath = path.resolve(
      /*turbopackIgnore: true*/ this.rootDir,
      cleanKey,
    );
    if (!fullPath.startsWith(this.rootDir)) {
      throw new AppError("FORBIDDEN", "Storage path traversal blocked.", 403);
    }
    return fullPath;
  }

  public async putObject(params: PutPrivateObjectParams): Promise<void> {
    const targetPath = this.resolveSafePath(params.storageKey);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, params.body);
  }

  public async getObjectBuffer(storageKey: string): Promise<Buffer> {
    const targetPath = this.resolveSafePath(storageKey);
    try {
      return await readFile(targetPath);
    } catch {
      throw new AppError("NOT_FOUND", "Stored document file not found.", 404);
    }
  }

  public async getSignedDownloadUrl(): Promise<null> {
    // Local private storage always streams through authorized server routes
    return null;
  }
}

class S3PrivateStorageAdapter implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly presignedTtl: number;

  constructor() {
    const env = getEnv();
    this.bucket = env.S3_BUCKET_NAME;
    this.presignedTtl = env.S3_PRESIGNED_URL_TTL_SECONDS;
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(env.S3_FORCE_PATH_STYLE),
      credentials:
        env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: env.S3_ACCESS_KEY_ID,
              secretAccessKey: env.S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }

  public async putObject(params: PutPrivateObjectParams): Promise<void> {
    const Key = assertSafeStorageKey(params.storageKey);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key,
        Body: params.body,
        ContentType: params.contentType,
        Metadata: params.metadata,
        ServerSideEncryption: "AES256",
      }),
    );
  }

  public async getObjectBuffer(storageKey: string): Promise<Buffer> {
    const Key = assertSafeStorageKey(storageKey);
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key }),
    );
    if (!res.Body) {
      throw new AppError("NOT_FOUND", "Object body empty in S3 storage.", 404);
    }
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  public async getSignedDownloadUrl(
    storageKey: string,
    downloadFilename: string,
  ): Promise<string> {
    const Key = assertSafeStorageKey(storageKey);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key,
      ResponseContentDisposition: `attachment; filename="${downloadFilename.replace(/"/g, "")}"`,
      ResponseCacheControl: "private, no-store",
    });
    return getSignedUrl(this.client, command, { expiresIn: this.presignedTtl });
  }
}

let cachedStorage: StorageProvider | null = null;

export function getPrivateStorage(): StorageProvider {
  if (!cachedStorage) {
    const env = getEnv();
    cachedStorage =
      env.STORAGE_DRIVER === "s3"
        ? new S3PrivateStorageAdapter()
        : new LocalPrivateStorageAdapter(env.LOCAL_PRIVATE_STORAGE_DIR);
  }
  return cachedStorage;
}
