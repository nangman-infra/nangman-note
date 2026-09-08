import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTranscriptProviderResultId20260908150000 implements MigrationInterface {
  name = 'AddTranscriptProviderResultId20260908150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('transcript_segment');
    if (!table?.findColumnByName('provider_result_id')) {
      await queryRunner.addColumn(
        'transcript_segment',
        new TableColumn({
          name: 'provider_result_id',
          type: 'varchar',
          length: '200',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('transcript_segment');
    if (table?.findColumnByName('provider_result_id')) {
      await queryRunner.dropColumn('transcript_segment', 'provider_result_id');
    }
  }
}
