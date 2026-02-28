import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
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
}
