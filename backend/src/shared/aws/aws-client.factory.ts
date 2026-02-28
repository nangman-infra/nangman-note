import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fromIni } from '@aws-sdk/credential-providers';
import { S3Client } from '@aws-sdk/client-s3';
import { TranscribeClient } from '@aws-sdk/client-transcribe';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { AppEnv } from '../config/env.validation';

@Injectable()
export class AwsClientFactory {
  private readonly region: string;
  private readonly credentials: ReturnType<typeof fromIni>;

  constructor(private readonly configService: ConfigService<AppEnv, true>) {
    this.region = this.configService.get('AWS_REGION', { infer: true });
    const profile = this.configService.get('AWS_PROFILE', { infer: true });
    this.credentials = fromIni({ profile });
  }

  createS3Client(): S3Client {
    return new S3Client({
      region: this.region,
      credentials: this.credentials,
    });
  }

  createTranscribeClient(): TranscribeClient {
    return new TranscribeClient({
      region: this.region,
      credentials: this.credentials,
    });
  }

  createBedrockRuntimeClient(): BedrockRuntimeClient {
    return new BedrockRuntimeClient({
      region: this.region,
      credentials: this.credentials,
    });
  }

  getRegion(): string {
    return this.region;
  }
}