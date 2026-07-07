import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthOwnerScope20260302130000 implements MigrationInterface {
  name = 'AddAuthOwnerScope20260302130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "meeting"
      ADD COLUMN IF NOT EXISTS "owner_sub" varchar(255)
    `);

    await queryRunner.query(`
      ALTER TABLE "prompt"
      ADD COLUMN IF NOT EXISTS "owner_sub" varchar(255)
    `);

    await queryRunner.query(`
      ALTER TABLE "meeting_search_document"
      ADD COLUMN IF NOT EXISTS "owner_sub" varchar(255)
    `);

    await queryRunner.query(`
      UPDATE "meeting_search_document" doc
      SET "owner_sub" = m."owner_sub"
      FROM "meeting" m
      WHERE doc."meeting_id" = m."id"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_meeting_owner_sub"
      ON "meeting" ("owner_sub")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_prompt_owner_sub"
      ON "prompt" ("owner_sub")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_meeting_search_document_owner_sub"
      ON "meeting_search_document" ("owner_sub")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_meeting_search_document_owner_sub"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_prompt_owner_sub"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_meeting_owner_sub"`);

    await queryRunner.query(
      `ALTER TABLE "meeting_search_document" DROP COLUMN IF EXISTS "owner_sub"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt" DROP COLUMN IF EXISTS "owner_sub"`,
    );
    await queryRunner.query(
      `ALTER TABLE "meeting" DROP COLUMN IF EXISTS "owner_sub"`,
    );
  }
}
