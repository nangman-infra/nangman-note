import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMeetingProcessingPhase20260317110000 implements MigrationInterface {
  name = 'AddMeetingProcessingPhase20260317110000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "meeting"
      ADD COLUMN "processing_phase" character varying(32)
    `);
    await queryRunner.query(`
      ALTER TABLE "meeting"
      ADD COLUMN "needs_attention" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_meeting_owner_started_status_phase"
      ON "meeting" ("owner_sub", "started_at" DESC, "status", "processing_phase")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "public"."IDX_meeting_owner_started_status_phase"
    `);
    await queryRunner.query(`
      ALTER TABLE "meeting"
      DROP COLUMN "needs_attention"
    `);
    await queryRunner.query(`
      ALTER TABLE "meeting"
      DROP COLUMN "processing_phase"
    `);
  }
}
