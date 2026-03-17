import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { S3Client } from '@aws-sdk/client-s3';
import { AwsClientFactory } from '../aws-client.factory';
import { AppEnv } from '../../config/env.validation';

const PRESIGNED_URL_EXPIRY_SECONDS = 600; // 10분

@Injectable()
export class S3AudioService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly keyPrefix: string;

  constructor(
    private readonly configService: ConfigService<AppEnv, true>,
    private readonly awsClientFactory: AwsClientFactory,
  ) {
    this.s3Client = this.awsClientFactory.createS3Client();
    this.bucket = this.configService.get('AWS_S3_AUDIO_BUCKET', {
      infer: true,
    });
    this.keyPrefix = this.configService.get('AWS_S3_AUDIO_KEY_PREFIX', {
      infer: true,
    });
  }

  async generateUploadUrl(meetingId: string): Promise<{
    uploadUrl: string;
    s3Key: string;
    bucket: string;
    mediaUri: string;
    expiresInSeconds: number;
  }> {
    if (!this.bucket) {
      throw new BadRequestException(
        'S3 audio bucket is not configured. Set AWS_S3_AUDIO_BUCKET environment variable.',
      );
    }

    const timestamp = Date.now();
    const s3Key = `${this.keyPrefix}/${meetingId}/${timestamp}.webm`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      ContentType: 'audio/webm',
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
    });

    return {
      uploadUrl,
      s3Key,
      bucket: this.bucket,
      mediaUri: this.buildMediaUri(s3Key),
      expiresInSeconds: PRESIGNED_URL_EXPIRY_SECONDS,
    };
  }

  buildMediaUri(s3Key: string): string {
    return `s3://${this.bucket}/${s3Key}`;
  }

  async deleteAudioFile(s3Key: string): Promise<void> {
    if (!this.bucket) return;

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
    });

    await this.s3Client.send(command);
  }

  async getObjectAsString(s3Key: string): Promise<string> {
    return this.getObjectAsStringFromBucket(this.bucket, s3Key);
  }

  async getObjectAsStringFromBucket(
    bucket: string,
    s3Key: string,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: s3Key,
    });

    const response = await this.s3Client.send(command);
    const body = await response.Body?.transformToString('utf-8');
    return body ?? '';
  }

  parseMediaUri(mediaUri: string): { bucket: string; s3Key: string } {
    const normalized = mediaUri.trim();
    if (!normalized.startsWith('s3://')) {
      throw new BadRequestException('mediaUri must start with s3://');
    }

    const withoutScheme = normalized.slice('s3://'.length);
    const slashIndex = withoutScheme.indexOf('/');
    if (slashIndex <= 0 || slashIndex === withoutScheme.length - 1) {
      throw new BadRequestException('mediaUri must be a valid s3://bucket/key URI');
    }

    return {
      bucket: withoutScheme.slice(0, slashIndex),
      s3Key: withoutScheme.slice(slashIndex + 1),
    };
  }

  isManagedMediaUri(mediaUri: string): boolean {
    try {
      const { bucket, s3Key } = this.parseMediaUri(mediaUri);
      return bucket === this.bucket && s3Key.startsWith(`${this.keyPrefix}/`);
    } catch {
      return false;
    }
  }

  async objectExists(bucket: string, s3Key: string): Promise<boolean> {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: s3Key,
    });

    try {
      await this.s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async objectExistsForMediaUri(mediaUri: string): Promise<boolean> {
    const { bucket, s3Key } = this.parseMediaUri(mediaUri);
    return this.objectExists(bucket, s3Key);
  }
}
