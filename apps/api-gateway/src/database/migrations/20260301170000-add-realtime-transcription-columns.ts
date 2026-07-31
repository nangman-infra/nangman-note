import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRealtimeTranscriptionColumns20260301170000 implements MigrationInterface {
  name = 'AddRealtimeTranscriptionColumns20260301170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "meeting"
      ADD COLUMN IF NOT EXISTS "agenda" text
    `);
    await queryRunner.query(`
      ALTER TABLE "meeting"
      ADD COLUMN IF NOT EXISTS "language_code" character varying(20)
    `);
    await queryRunner.query(`
      ALTER TABLE "meeting"
      ADD COLUMN IF NOT EXISTS "translate_target_language" character varying(10)
    `);

    await queryRunner.query(`
      ALTER TABLE "transcript_segment"
      ADD COLUMN IF NOT EXISTS "translated_text" text
    `);
    await queryRunner.query(`
      ALTER TABLE "transcript_segment"
      ADD COLUMN IF NOT EXISTS "detected_language" character varying(20)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transcript_segment"
      DROP COLUMN IF EXISTS "detected_language"
    `);
    await queryRunner.query(`
      ALTER TABLE "transcript_segment"
      DROP COLUMN IF EXISTS "translated_text"
    `);

    await queryRunner.query(`
      ALTER TABLE "meeting"
      DROP COLUMN IF EXISTS "translate_target_language"
    `);
    await queryRunner.query(`
      ALTER TABLE "meeting"
      DROP COLUMN IF EXISTS "language_code"
    `);
    await queryRunner.query(`
      ALTER TABLE "meeting"
      DROP COLUMN IF EXISTS "agenda"
    `);
  }
}
