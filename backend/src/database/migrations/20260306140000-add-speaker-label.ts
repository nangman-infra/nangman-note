import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSpeakerLabel1741240800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('transcript_segment');
    if (!table) return;

    const hasColumn = table.findColumnByName('speaker_label');
    if (hasColumn) return;

    await queryRunner.addColumn(
      'transcript_segment',
      new TableColumn({
        name: 'speaker_label',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('transcript_segment');
    if (!table) return;

    const hasColumn = table.findColumnByName('speaker_label');
    if (!hasColumn) return;

    await queryRunner.dropColumn('transcript_segment', 'speaker_label');
  }
}
