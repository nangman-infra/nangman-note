import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { applyE2eAppConfig } from './apply-e2e-app-config';
import { DataSource } from 'typeorm';
import { EncryptionService } from '../src/shared/crypto/encryption.service';

describe('Note Flow (e2e)', () => {
  let app: INestApplication<App>;
  let originalNodeEnv: string | undefined;

  beforeAll(async () => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyE2eAppConfig(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('supports note virtual read, save, and empty-content overwrite', async () => {
    const createMeetingRes = await request(app.getHttpServer())
      .post('/api/v1/meetings')
      .send({
        title: 'note e2e meeting',
        transcriptionMode: 'batch',
      })
      .expect(201);

    const meetingId = (createMeetingRes.body as { data: { id: string } }).data
      .id;

    const firstGetRes = await request(app.getHttpServer())
      .get(`/api/v1/meetings/${meetingId}/note`)
      .expect(200);

    expect(
      (firstGetRes.body as { data: { content: string } }).data.content,
    ).toBe('');
    expect((firstGetRes.body as { data: { id: string } }).data.id).toBe(
      `note_virtual_${meetingId}`,
    );

    await request(app.getHttpServer())
      .put(`/api/v1/meetings/${meetingId}/note`)
      .send({ content: '회의 핵심 정리', expectedRevision: 0 })
      .expect(200);

    const secondGetRes = await request(app.getHttpServer())
      .get(`/api/v1/meetings/${meetingId}/note`)
      .expect(200);
    expect(
      (secondGetRes.body as { data: { content: string } }).data.content,
    ).toBe('회의 핵심 정리');

    await request(app.getHttpServer())
      .put(`/api/v1/meetings/${meetingId}/note`)
      .send({ content: '', expectedRevision: 1 })
      .expect(200);

    const thirdGetRes = await request(app.getHttpServer())
      .get(`/api/v1/meetings/${meetingId}/note`)
      .expect(200);
    expect(
      (thirdGetRes.body as { data: { content: string } }).data.content,
    ).toBe('');
  });

  it('returns 404 when meeting does not exist', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/meetings/11111111-1111-4111-8111-111111111111/note')
      .expect(404);
  });

  it('protects concurrent edits, preserves encryption, and indexes the winning content', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/meetings')
      .send({ title: 'concurrent notes', transcriptionMode: 'batch' })
      .expect(201);
    const id = (created.body as { data: { id: string } }).data.id;
    const url = `/api/v1/meetings/${id}/note`;
    const save = (content: string, expectedRevision: number) =>
      request(app.getHttpServer()).put(url).send({ content, expectedRevision });

    const firstSaves = await Promise.all([
      save('first A', 0),
      save('first B', 0),
    ]);
    expect(firstSaves.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);

    const updates = await Promise.all([
      save('노트검색승자 A', 1),
      save('노트검색승자 B', 1),
    ]);
    expect(updates.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const winner = updates.find((response) => response.status === 200)!;
    const saved = (
      winner.body as { data: { content: string; revision: number } }
    ).data;
    expect(saved.revision).toBe(2);

    const loaded = await request(app.getHttpServer()).get(url).expect(200);
    expect(
      (loaded.body as { data: { content: string; revision: number } }).data,
    ).toMatchObject(saved);

    const rows = await app
      .get(DataSource)
      .query<
        Array<{ content: string; revision: number }>
      >('SELECT content, revision FROM note WHERE meeting_id = ?', [id]);
    expect(rows[0].revision).toBe(2);
    expect(app.get(EncryptionService).isEncrypted(rows[0].content)).toBe(true);
    expect(rows[0].content).not.toContain('노트검색승자');

    await save(saved.content, 1).expect(200); // lost-ack retry
    await save('stale overwrite', 1).expect(409);
    const search = await request(app.getHttpServer())
      .get('/api/v1/meetings/search')
      .query({ q: '노트검색승자', scope: 'note' })
      .expect(200);
    expect(JSON.stringify(search.body)).toContain(id);

    await request(app.getHttpServer())
      .put(url)
      .send({ content: 'unversioned' })
      .expect(400);
    await save('invalid', -1).expect(400);
    await save('x'.repeat(100_001), 2).expect(400);
  });
});
