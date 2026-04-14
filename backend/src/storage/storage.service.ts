import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { parseUrlPort, pickLanIPv4 } from '../util/lan-ipv4';

function isLoopbackHost(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '::1';
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

/**
 * Presigned URL должны открываться с телефона. Если в env только localhost —
 * подставляем LAN-IP этой машины (dev). Явный S3_PRESIGN_ENDPOINT всегда важнее.
 */
function resolvePresignEndpoint(internalEndpoint: string): string {
  const explicit = process.env.S3_PRESIGN_ENDPOINT?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const fromS3Endpoint = process.env.S3_ENDPOINT?.trim();
  if (fromS3Endpoint && !isLoopbackHost(fromS3Endpoint)) {
    return fromS3Endpoint.replace(/\/$/, '');
  }

  if (!isLoopbackHost(internalEndpoint)) {
    return internalEndpoint.replace(/\/$/, '');
  }

  const lan = pickLanIPv4();
  const port = parseUrlPort(internalEndpoint, '9000');
  if (lan) {
    return `http://${lan}:${port}`;
  }

  return internalEndpoint.replace(/\/$/, '');
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);

  /** Операции с бакетом с машины, где крутится Nest (часто localhost). */
  private internalClient: S3Client;
  /** Presigned PUT — хост должен быть доступен с телефона / браузера (LAN или публичный URL). */
  private presignClient: S3Client;
  private bucket: string;
  private publicBase: string;

  constructor() {
    const internalEndpoint =
      process.env.S3_INTERNAL_ENDPOINT ||
      process.env.S3_ENDPOINT ||
      'http://127.0.0.1:9000';
    const presignEndpoint = resolvePresignEndpoint(internalEndpoint);

    this.bucket = process.env.S3_BUCKET || 'corp-uploads';
    const defaultPublic = `${presignEndpoint}/${this.bucket}`;
    this.publicBase = (
      process.env.S3_PUBLIC_BASE_URL?.trim() || defaultPublic
    ).replace(/\/$/, '');

    this.logger.log(
      `S3 internal=${internalEndpoint.replace(/\/$/, '')} presign/public host=${presignEndpoint} (bucket=${this.bucket})`,
    );

    const credentials = {
      accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
      secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
    };
    const region = process.env.S3_REGION || 'us-east-1';

    /** Без лишнего httpChecksum в presigned PUT (клиент шлёт только Content-Type + тело). */
    const s3ClientBase = {
      region,
      forcePathStyle: true,
      credentials,
      requestChecksumCalculation: 'WHEN_REQUIRED' as const,
    };
    this.internalClient = new S3Client({
      ...s3ClientBase,
      endpoint: internalEndpoint,
    });
    this.presignClient = new S3Client({
      ...s3ClientBase,
      endpoint: presignEndpoint,
    });
  }

  async onModuleInit() {
    try {
      await this.internalClient.send(
        new HeadBucketCommand({ Bucket: this.bucket }),
      );
    } catch {
      await this.internalClient.send(
        new CreateBucketCommand({ Bucket: this.bucket }),
      );
    }
  }

  async presignPut(userId: string, contentType: string, ext: string) {
    const key = `uploads/${userId}/${randomUUID()}.${ext.replace(/^\./, '')}`;
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.presignClient, cmd, {
      expiresIn: 3600,
    });
    const publicUrl = `${this.publicBase.replace(/\/$/, '')}/${key}`;
    return { uploadUrl, storageKey: key, publicUrl };
  }

  keyToPublicUrl(key: string) {
    return `${this.publicBase.replace(/\/$/, '')}/${key}`;
  }

  /** Временная ссылка на чтение (для `<Image>` / `<img>` без JWT и без публичного бакета). */
  async presignGetObject(key: string, expiresIn = 604800) {
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.presignClient, cmd, { expiresIn });
  }
}
