import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddNoteRevision20260909100000 implements MigrationInterface {
  name = 'AddNoteRevision20260909100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('note', 'revision'))) {
      await queryRunner.addColumn(
        'note',
        new TableColumn({ name: 'revision', type: 'integer', default: 1 }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('note', 'revision')) {
      await queryRunner.dropColumn('note', 'revision');
    }
  }
}
