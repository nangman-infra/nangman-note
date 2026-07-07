import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddTranscriptionUpload20260317140000 implements MigrationInterface {
  name = 'AddTranscriptionUpload20260317140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'transcription_upload',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'meeting_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'bucket',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 's3_key',
            type: 'varchar',
            length: '2048',
            isNullable: false,
          },
          {
            name: 'media_uri',
            type: 'varchar',
            length: '2048',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '32',
            isNullable: false,
            default: "'issued'",
          },
          {
            name: 'content_type',
            type: 'varchar',
            length: '128',
            isNullable: false,
            default: "'audio/webm'",
          },
          {
            name: 'transcription_job_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'confirmed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'job_queued_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['meeting_id'],
            referencedTableName: 'meeting',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    await queryRunner.createIndices('transcription_upload', [
      new TableIndex({
        name: 'IDX_transcription_upload_meeting_created',
        columnNames: ['meeting_id', 'created_at'],
      }),
      new TableIndex({
        name: 'IDX_transcription_upload_meeting_status',
        columnNames: ['meeting_id', 'status'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'transcription_upload',
      'IDX_transcription_upload_meeting_status',
    );
    await queryRunner.dropIndex(
      'transcription_upload',
      'IDX_transcription_upload_meeting_created',
    );
    await queryRunner.dropTable('transcription_upload');
  }
}
