import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RebuildEncryptedMeetingSearchDocuments20260826100000 implements MigrationInterface {
  name = 'RebuildEncryptedMeetingSearchDocuments20260826100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // This is a derived projection. Removing legacy plaintext lets the normal
    // coverage path recreate each row through the encryption subscriber.
    await queryRunner.query(`DELETE FROM "meeting_search_document"`);
  }

  public async down(): Promise<void> {
    // Derived rows are rebuilt lazily; there is no plaintext state to restore.
  }
}
