import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

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

    const meetingId = (createMeetingRes.body as { id: string }).id;

    const firstGetRes = await request(app.getHttpServer())
      .get(`/api/v1/meetings/${meetingId}/note`)
      .expect(200);

    expect((firstGetRes.body as { content: string }).content).toBe('');
    expect((firstGetRes.body as { id: string }).id).toBe(
      `note_virtual_${meetingId}`,
    );

    await request(app.getHttpServer())
      .put(`/api/v1/meetings/${meetingId}/note`)
      .send({ content: '회의 핵심 정리' })
      .expect(200);

    const secondGetRes = await request(app.getHttpServer())
      .get(`/api/v1/meetings/${meetingId}/note`)
      .expect(200);
    expect((secondGetRes.body as { content: string }).content).toBe(
      '회의 핵심 정리',
    );

    await request(app.getHttpServer())
      .put(`/api/v1/meetings/${meetingId}/note`)
      .send({ content: '' })
      .expect(200);

    const thirdGetRes = await request(app.getHttpServer())
      .get(`/api/v1/meetings/${meetingId}/note`)
      .expect(200);
    expect((thirdGetRes.body as { content: string }).content).toBe('');
  });

  it('returns 404 when meeting does not exist', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/meetings/00000000-0000-0000-0000-000000000000/note')
      .expect(404);
  });
});
