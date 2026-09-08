import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const SENSITIVE_COLUMNS_BY_TABLE: Record<string, string[]> = {
  note: ['content'],
  meeting_result: ['content'],
  transcript_segment: ['text', 'translated_text'],
  meeting_search_document: [
    'note_content',
    'result_content',
    'transcript_content',
  ],
};

function extractRawSql(source: string): string[] {
  return Array.from(
    source.matchAll(/queryRunner\.query\(\s*`([\s\S]*?)`\s*\)/gu),
    (match) => match[1],
  );
}

describe('migration encryption policy', () => {
  it('does not write encryptable columns through raw migration SQL', () => {
    const directory = __dirname;
    const violations: string[] = [];

    for (const file of readdirSync(directory)) {
      if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) continue;
      const source = readFileSync(join(directory, file), 'utf8');

      for (const sql of extractRawSql(source)) {
        for (const [table, sensitiveColumns] of Object.entries(
          SENSITIVE_COLUMNS_BY_TABLE,
        )) {
          const normalized = sql.replace(/\s+/gu, ' ').trim();
          const insert = normalized.match(
            new RegExp(`INSERT\\s+INTO\\s+"?${table}"?\\s*\\(([^)]*)\\)`, 'iu'),
          );
          const update = normalized.match(
            new RegExp(
              `UPDATE\\s+"?${table}"?(?:\\s+\\w+)?\\s+SET\\s+(.+?)(?:\\s+FROM\\s+|\\s+WHERE\\s+|$)`,
              'iu',
            ),
          );
          const writtenClause = insert?.[1] ?? update?.[1];
          if (
            writtenClause &&
            sensitiveColumns.some((column) =>
              new RegExp(`"?${column}"?\\s*(?:,|=|$)`, 'iu').test(
                writtenClause,
              ),
            )
          ) {
            violations.push(`${file}: ${table}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
