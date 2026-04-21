import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMeetingCompletionState20260317160000 implements MigrationInterface {
  name = 'AddMeetingCompletionState20260317160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "meeting"
      ADD COLUMN "completion_state" varchar(32)
    `);

    await queryRunner.query(`
      UPDATE "meeting" AS m
      SET
        "completion_state" = CASE
          WHEN m."needs_attention" THEN 'attention_required'
          WHEN NOT EXISTS (
            SELECT 1
            FROM "meeting_result" AS r
            WHERE r."meeting_id" = m."id"
          ) THEN 'attention_required'
          WHEN EXISTS (
            SELECT 1
            FROM "note" AS n
            WHERE
              n."meeting_id" = m."id"
              AND BTRIM(COALESCE(n."content", '')) <> ''
          )
          AND EXISTS (
            SELECT 1
            FROM "transcript_segment" AS s
            WHERE
              s."meeting_id" = m."id"
              AND BTRIM(COALESCE(s."text", '')) <> ''
          ) THEN 'succeeded'
          WHEN EXISTS (
            SELECT 1
            FROM "note" AS n
            WHERE
              n."meeting_id" = m."id"
              AND BTRIM(COALESCE(n."content", '')) <> ''
          )
          OR EXISTS (
            SELECT 1
            FROM "transcript_segment" AS s
            WHERE
              s."meeting_id" = m."id"
              AND BTRIM(COALESCE(s."text", '')) <> ''
          ) THEN 'partial'
          ELSE 'attention_required'
        END
      WHERE m."status" = 'completed'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "meeting"
      DROP COLUMN "completion_state"
    `);
  }
}
