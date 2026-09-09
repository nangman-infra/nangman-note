import { DataSource } from 'typeorm';
import { AddNoteRevision20260909100000 } from './20260909100000-add-note-revision';

it('backfills existing notes without changing their content and supports rollback', async () => {
  const source = await new DataSource({ type: 'sqljs' }).initialize();
  const runner = source.createQueryRunner();
  try {
    await runner.query(
      'CREATE TABLE note (id text PRIMARY KEY, content text NOT NULL)',
    );
    await runner.query('INSERT INTO note (id, content) VALUES (?, ?)', [
      'existing',
      'encrypted-content',
    ]);
    const migration = new AddNoteRevision20260909100000();
    await migration.up(runner);
    await migration.up(runner);
    expect(await runner.query('SELECT content, revision FROM note')).toEqual([
      { content: 'encrypted-content', revision: 1 },
    ]);
    await migration.down(runner);
    expect(await runner.hasColumn('note', 'revision')).toBe(false);
    expect(await runner.query('SELECT content FROM note')).toEqual([
      { content: 'encrypted-content' },
    ]);
  } finally {
    await runner.release();
    await source.destroy();
  }
});
