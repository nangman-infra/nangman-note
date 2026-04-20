import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTranscriptionJobCollectedAt20260421010000 implements MigrationInterface {
  name = 'AddTranscriptionJobCollectedAt20260421010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('transcription_job');
    if (!table?.findColumnByName('collected_at')) {
      await queryRunner.addColumn(
        'transcription_job',
        new TableColumn({
          name: 'collected_at',
          type: 'timestamp',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('transcription_job');
    if (table?.findColumnByName('collected_at')) {
      await queryRunner.dropColumn('transcription_job', 'collected_at');
    }
  }
}
