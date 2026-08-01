import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NoteModule } from './domain/note/note.module';
import { AuthModule } from './shared/auth/auth.module';
import { CryptoModule } from './shared/crypto/crypto.module';
import { AppEnv, validateEnv } from './shared/config/env.validation';
import { buildTypeOrmModuleOptions } from './shared/config/typeorm-options.factory';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnv, true>) => {
        return buildTypeOrmModuleOptions({
          NODE_ENV: configService.get('NODE_ENV', { infer: true }),
          DB_ENGINE: configService.get('DB_ENGINE', { infer: true }),
          DB_MIGRATIONS_RUN: configService.get('DB_MIGRATIONS_RUN', { infer: true }),
          DB_PATH: configService.get('DB_PATH', { infer: true }),
          DB_HOST: configService.get('DB_HOST', { infer: true }),
          DB_PORT: configService.get('DB_PORT', { infer: true }),
          DB_NAME: configService.get('DB_NAME', { infer: true }),
          DB_USER: configService.get('DB_USER', { infer: true }),
          DB_PASSWORD: configService.get('DB_PASSWORD', { infer: true }),
          DB_IAM_AUTH: configService.get('DB_IAM_AUTH', { infer: true }),
          AWS_REGION: configService.get('AWS_REGION', { infer: true }),
          DB_SSL: configService.get('DB_SSL', { infer: true }),
          DB_SSL_REJECT_UNAUTHORIZED: configService.get('DB_SSL_REJECT_UNAUTHORIZED', { infer: true }),
          DB_POOL_MAX: configService.get('DB_POOL_MAX', { infer: true }),
          DB_CONNECTION_TIMEOUT_MS: configService.get('DB_CONNECTION_TIMEOUT_MS', { infer: true }),
          DB_IDLE_TIMEOUT_MS: configService.get('DB_IDLE_TIMEOUT_MS', { infer: true }),
          DB_STATEMENT_TIMEOUT_MS: configService.get('DB_STATEMENT_TIMEOUT_MS', { infer: true }),
        });
      },
    }),
    CryptoModule,
    AuthModule,
    NoteModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
