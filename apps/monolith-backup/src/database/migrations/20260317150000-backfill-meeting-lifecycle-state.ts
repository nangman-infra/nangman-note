import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillMeetingLifecycleState20260317150000 implements MigrationInterface {
  name = 'BackfillMeetingLifecycleState20260317150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "meeting" AS m
      SET
        "status" = 'completed',
        "processing_phase" = NULL
      WHERE
        m."status" = 'processing'
        AND EXISTS (
          SELECT 1
          FROM "meeting_result" AS r
          WHERE r."meeting_id" = m."id"
        )
    `);

    await queryRunner.query(`
      UPDATE "meeting" AS m
      SET
        "processing_phase" = NULL,
        "needs_attention" = CASE
          WHEN m."needs_attention" THEN true
          WHEN NOT EXISTS (
            SELECT 1
            FROM "meeting_result" AS r
            WHERE r."meeting_id" = m."id"
          ) THEN true
          WHEN NOT EXISTS (
            SELECT 1
            FROM "note" AS n
            WHERE
              n."meeting_id" = m."id"
              AND BTRIM(COALESCE(n."content", '')) <> ''
          )
          AND NOT EXISTS (
            SELECT 1
            FROM "transcript_segment" AS s
            WHERE s."meeting_id" = m."id"
          ) THEN true
          ELSE false
        END
      WHERE m."status" = 'completed'
    `);

    await queryRunner.query(`
      UPDATE "meeting" AS m
      SET
        "processing_phase" = NULL,
        "needs_attention" = false
      WHERE m."status" = 'recording'
    `);

    await queryRunner.query(`
      UPDATE "meeting" AS m
      SET "processing_phase" = 'generating'
      WHERE
        m."status" = 'processing'
        AND m."transcription_mode" = 'realtime'
    `);

    await queryRunner.query(`
      UPDATE "meeting" AS m
      SET
        "processing_phase" = 'generating',
        "needs_attention" = CASE
          WHEN m."needs_attention" THEN true
          WHEN latest_job."status" = 'failed' THEN true
          ELSE false
        END
      FROM (
        SELECT DISTINCT ON (tj."meeting_id")
          tj."meeting_id",
          tj."status"
        FROM "transcription_job" AS tj
        ORDER BY tj."meeting_id", tj."created_at" DESC, tj."id" DESC
      ) AS latest_job
      WHERE
        latest_job."meeting_id" = m."id"
        AND
        m."status" = 'processing'
        AND m."transcription_mode" = 'batch'
        AND latest_job."status" IN ('completed', 'failed')
    `);

    await queryRunner.query(`
      UPDATE "meeting" AS m
      SET
        "processing_phase" = 'transcribing',
        "needs_attention" = false
      FROM (
        SELECT DISTINCT ON (tj."meeting_id")
          tj."meeting_id",
          tj."status"
        FROM "transcription_job" AS tj
        ORDER BY tj."meeting_id", tj."created_at" DESC, tj."id" DESC
      ) AS latest_job
      WHERE
        latest_job."meeting_id" = m."id"
        AND
        m."status" = 'processing'
        AND m."transcription_mode" = 'batch'
        AND latest_job."status" IN ('queued', 'processing')
    `);

    await queryRunner.query(`
      UPDATE "meeting" AS m
      SET
        "processing_phase" = 'generating',
        "needs_attention" = COALESCE(m."needs_attention", false)
      WHERE
        m."status" = 'processing'
        AND m."transcription_mode" = 'batch'
        AND NOT EXISTS (
          SELECT 1
          FROM "transcription_job" AS tj
          WHERE tj."meeting_id" = m."id"
        )
        AND EXISTS (
          SELECT 1
          FROM "transcript_segment" AS s
          WHERE s."meeting_id" = m."id"
        )
    `);

    await queryRunner.query(`
      UPDATE "meeting" AS m
      SET
        "processing_phase" = 'uploading',
        "needs_attention" = CASE
          WHEN m."needs_attention" THEN true
          WHEN m."ended_at" IS NOT NULL
            AND m."ended_at" <= NOW() - INTERVAL '1 hour'
          THEN true
          ELSE false
        END
      WHERE
        m."status" = 'processing'
        AND m."transcription_mode" = 'batch'
        AND NOT EXISTS (
          SELECT 1
          FROM "transcription_job" AS tj
          WHERE tj."meeting_id" = m."id"
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "transcript_segment" AS s
          WHERE s."meeting_id" = m."id"
        )
    `);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async down(_queryRunner: QueryRunner): Promise<void> {
    // This migration only backfills derived lifecycle state from existing data.
    // The original rows remain intact; no safe reversible transformation exists.
  }
}
