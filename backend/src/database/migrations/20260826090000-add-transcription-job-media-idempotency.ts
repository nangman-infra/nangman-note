import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddTranscriptionJobMediaIdempotency20260826090000 implements MigrationInterface {
  name = 'AddTranscriptionJobMediaIdempotency20260826090000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'transcription_job',
      new TableColumn({
        name: 'idempotency_key',
        type: 'varchar',
        length: '2048',
        isNullable: true,
      }),
    );
    await queryRunner.createIndex(
      'transcription_job',
      new TableIndex({
        name: 'UQ_transcription_job_meeting_media_idempotency',
        columnNames: ['meeting_id', 'idempotency_key'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'transcription_job',
      'UQ_transcription_job_meeting_media_idempotency',
    );
    await queryRunner.dropColumn('transcription_job', 'idempotency_key');
  }
}
