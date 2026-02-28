import { mkdirSync } from 'fs';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dirname, resolve } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MeetingModule } from './domain/meeting/meeting.module';
import { NoteModule } from './domain/note/note.module';
import { PromptModule } from './domain/prompt/prompt.module';
import { ResultModule } from './domain/result/result.module';
import { TranscriptionModule } from './domain/transcription/transcription.module';
import { AwsModule } from './shared/aws/aws.module';
import { AppEnv, validateEnv } from './shared/config/env.validation';

function resolveDatabasePath(dbPath: string): string {
  if (dbPath === ':memory:') {
    return dbPath;
  }

  const resolved = resolve(process.cwd(), dbPath);
  mkdirSync(dirname(resolved), { recursive: true });
  return resolved;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      validate: validateEnv,
    }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnv, true>) => {
        const nodeEnv = configService.get('NODE_ENV', { infer: true });
        const dbPath = configService.get('DB_PATH', { infer: true });
        const resolvedDbPath = resolveDatabasePath(dbPath);

        return {
          type: 'sqljs' as const,
          location: resolvedDbPath === ':memory:' ? undefined : resolvedDbPath,
          autoSave: resolvedDbPath !== ':memory:',
          autoLoadEntities: true,
          synchronize: nodeEnv !== 'production',
          logging: nodeEnv === 'development',
        };
      },
    }),
    AwsModule,
    PromptModule,
    MeetingModule,
    NoteModule,
    ResultModule,
    TranscriptionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
