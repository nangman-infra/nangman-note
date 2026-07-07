import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMeetingSearchDocument20260302083000 implements MigrationInterface {
  name = 'AddMeetingSearchDocument20260302083000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "meeting_search_document" (
        "meeting_id" uuid NOT NULL,
        "title" text NOT NULL DEFAULT '',
        "note_content" text NOT NULL DEFAULT '',
        "result_content" text NOT NULL DEFAULT '',
        "transcript_content" text NOT NULL DEFAULT '',
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_meeting_search_document_meeting_id" PRIMARY KEY ("meeting_id"),
        CONSTRAINT "FK_meeting_search_document_meeting_id"
          FOREIGN KEY ("meeting_id") REFERENCES "meeting"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_meeting_search_document_updated_at"
      ON "meeting_search_document" ("updated_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_meeting_search_document_updated_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "meeting_search_document"`);
  }
}
