import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPromptDocumentType1741345200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('prompt');
    if (!table) return;

    const hasColumn = table.findColumnByName('document_type');
    if (!hasColumn) {
      await queryRunner.addColumn(
        'prompt',
        new TableColumn({
          name: 'document_type',
          type: 'varchar',
          length: '20',
          isNullable: false,
          default: "'meeting'",
        }),
      );
    }

    await queryRunner.query(`
      UPDATE "prompt"
      SET "document_type" = CASE
        WHEN "id" = 'prompt_default_lecture' THEN 'lecture'
        WHEN "id" = 'prompt_default_seminar' THEN 'mentoring'
        ELSE 'meeting'
      END
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('prompt');
    if (!table) return;

    const hasColumn = table.findColumnByName('document_type');
    if (!hasColumn) return;

    await queryRunner.dropColumn('prompt', 'document_type');
  }
}
