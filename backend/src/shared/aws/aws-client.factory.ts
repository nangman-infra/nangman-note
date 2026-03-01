import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { S3Client } from '@aws-sdk/client-s3';
import { TranscribeClient } from '@aws-sdk/client-transcribe';
import { TranscribeStreamingClient } from '@aws-sdk/client-transcribe-streaming';
import { TranslateClient } from '@aws-sdk/client-translate';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { AppEnv } from '../config/env.validation';

@Injectable()
export class AwsClientFactory {
  private readonly region: string;
  private readonly credentials: ReturnType<typeof fromNodeProviderChain>;

  constructor(private readonly configService: ConfigService<AppEnv, true>) {
    this.region = this.configService.get('AWS_REGION', { infer: true });
    const profile = this.configService.get('AWS_PROFILE', { infer: true });

    // fromNodeProviderChain은 credential_process, SSO, fromIni, 환경 변수 등
    // 모든 AWS 인증 방식을 자동으로 지원합니다.
    this.credentials = fromNodeProviderChain({ profile });
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

  createTranscribeStreamingClient(): TranscribeStreamingClient {
    return new TranscribeStreamingClient({
      region: this.region,
      credentials: this.credentials,
    });
  }

  createTranslateClient(): TranslateClient {
    // AWS SDK v3 Translate 타입 해석 이슈로 no-unsafe-call 오탐 방지

    return new TranslateClient({
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
