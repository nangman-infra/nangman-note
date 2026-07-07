import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserSettings20260312120000 implements MigrationInterface {
  name = 'AddUserSettings20260312120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_settings" (
        "owner_sub" varchar(255) PRIMARY KEY,
        "default_prompt_id" varchar(120),
        "default_transcription_mode" varchar(20) NOT NULL DEFAULT 'realtime',
        "default_language_code" varchar(20) NOT NULL DEFAULT '',
        "default_translate_target_language" varchar(10) NOT NULL DEFAULT '',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_user_settings_default_prompt"
          FOREIGN KEY ("default_prompt_id")
          REFERENCES "prompt" ("id")
          ON DELETE SET NULL
          ON UPDATE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_settings_default_prompt_id"
      ON "user_settings" ("default_prompt_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_settings_default_prompt_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "user_settings"`);
  }
}
