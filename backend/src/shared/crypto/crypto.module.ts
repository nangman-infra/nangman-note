import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { EncryptionSubscriber } from './encryption.subscriber';

@Global()
@Module({
  providers: [EncryptionService, EncryptionSubscriber],
  exports: [EncryptionService],
})
export class CryptoModule {}
