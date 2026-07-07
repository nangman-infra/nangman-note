import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitPostgresSchema20260301030000 implements MigrationInterface {
  name = 'InitPostgresSchema20260301030000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE "prompt" (
        "id" character varying(120) NOT NULL,
        "name" character varying(100) NOT NULL,
        "content" text NOT NULL,
        "is_default" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_prompt_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "meeting" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" character varying(255),
        "prompt_id" character varying(120) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'recording',
        "transcription_mode" character varying(20) NOT NULL DEFAULT 'batch',
        "started_at" TIMESTAMP NOT NULL,
        "ended_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_meeting_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_meeting_prompt_id" FOREIGN KEY ("prompt_id") REFERENCES "prompt"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_meeting_started_at" ON "meeting" ("started_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_meeting_deleted_at" ON "meeting" ("deleted_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_meeting_status" ON "meeting" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "note" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "meeting_id" uuid NOT NULL,
        "content" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_note_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_note_meeting_id" UNIQUE ("meeting_id"),
        CONSTRAINT "FK_note_meeting_id" FOREIGN KEY ("meeting_id") REFERENCES "meeting"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "meeting_result" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "meeting_id" uuid NOT NULL,
        "prompt_id" character varying(120) NOT NULL,
        "content" text NOT NULL,
        "metadata" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_meeting_result_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_meeting_result_meeting_id" UNIQUE ("meeting_id"),
        CONSTRAINT "FK_meeting_result_meeting_id" FOREIGN KEY ("meeting_id") REFERENCES "meeting"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_meeting_result_prompt_id" FOREIGN KEY ("prompt_id") REFERENCES "prompt"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "transcript_segment" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "meeting_id" uuid NOT NULL,
        "start_time" double precision NOT NULL,
        "end_time" double precision NOT NULL,
        "text" text NOT NULL,
        "confidence" double precision NOT NULL DEFAULT 0.9,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transcript_segment_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transcript_segment_meeting_id" FOREIGN KEY ("meeting_id") REFERENCES "meeting"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_transcript_segment_meeting_id" ON "transcript_segment" ("meeting_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "transcription_job" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "meeting_id" uuid NOT NULL,
        "provider" character varying(40) NOT NULL DEFAULT 'aws_transcribe',
        "provider_job_id" character varying(255) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'queued',
        "media_uri" character varying(2048) NOT NULL,
        "language_code" character varying(32) NOT NULL DEFAULT 'ko-KR',
        "transcript_uri" character varying(2048),
        "error_message" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transcription_job_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transcription_job_meeting_id" FOREIGN KEY ("meeting_id") REFERENCES "meeting"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_transcription_job_meeting_id" ON "transcription_job" ("meeting_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_transcription_job_meeting_id"`);
    await queryRunner.query(`DROP TABLE "transcription_job"`);

    await queryRunner.query(`DROP INDEX "IDX_transcript_segment_meeting_id"`);
    await queryRunner.query(`DROP TABLE "transcript_segment"`);

    await queryRunner.query(`DROP TABLE "meeting_result"`);
    await queryRunner.query(`DROP TABLE "note"`);

    await queryRunner.query(`DROP INDEX "IDX_meeting_status"`);
    await queryRunner.query(`DROP INDEX "IDX_meeting_deleted_at"`);
    await queryRunner.query(`DROP INDEX "IDX_meeting_started_at"`);
    await queryRunner.query(`DROP TABLE "meeting"`);

    await queryRunner.query(`DROP TABLE "prompt"`);
  }
}
