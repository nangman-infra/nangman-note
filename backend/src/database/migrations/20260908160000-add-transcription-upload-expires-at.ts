import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTranscriptionUploadExpiresAt20260908160000 implements MigrationInterface {
  name = 'AddTranscriptionUploadExpiresAt20260908160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('transcription_upload');
    if (!table?.findColumnByName('expires_at')) {
      await queryRunner.addColumn(
        'transcription_upload',
        new TableColumn({
          name: 'expires_at',
          type: 'timestamp',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('transcription_upload');
    if (table?.findColumnByName('expires_at')) {
      await queryRunner.dropColumn('transcription_upload', 'expires_at');
    }
  }
}
