import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { HttpAuthGuard } from './http-auth.guard';
import { OidcTokenVerifierService } from './oidc-token-verifier.service';

@Global()
@Module({
  providers: [
    OidcTokenVerifierService,
    HttpAuthGuard,
    {
      provide: APP_GUARD,
      useExisting: HttpAuthGuard,
    },
  ],
  exports: [OidcTokenVerifierService],
})
export class AuthModule {}
