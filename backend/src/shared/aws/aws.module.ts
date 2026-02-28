import { Global, Module } from '@nestjs/common';
import { AwsClientFactory } from './aws-client.factory';
import { S3AudioService } from './s3/s3.service';
import { BedrockService } from './bedrock/bedrock.service';

@Global()
@Module({
  providers: [AwsClientFactory, S3AudioService, BedrockService],
  exports: [AwsClientFactory, S3AudioService, BedrockService],
})
export class AwsModule {}
