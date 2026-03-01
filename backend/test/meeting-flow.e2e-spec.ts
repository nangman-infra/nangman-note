import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Meeting Flow (e2e)', () => {
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

  it('transitions batch meeting to processing on complete', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/meetings')
      .send({
        title: 'batch meeting',
        transcriptionMode: 'batch',
      })
      .expect(201);

    const meetingId = (createRes.body as { id: string }).id;

    const completeRes = await request(app.getHttpServer())
      .post(`/api/v1/meetings/${meetingId}/complete`)
      .send({})
      .expect(201);

    expect((completeRes.body as { status: string }).status).toBe('processing');
  });

  it('transitions realtime meeting to processing on complete', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/meetings')
      .send({
        title: 'realtime meeting',
        transcriptionMode: 'realtime',
      })
      .expect(201);

    const meetingId = (createRes.body as { id: string }).id;

    const completeRes = await request(app.getHttpServer())
      .post(`/api/v1/meetings/${meetingId}/complete`)
      .send({})
      .expect(201);

    expect((completeRes.body as { status: string }).status).toBe('processing');
  });

  it('transitions batch meeting to processing when skipTranscription=true', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/meetings')
      .send({
        title: 'batch skip meeting',
        transcriptionMode: 'batch',
      })
      .expect(201);

    const meetingId = (createRes.body as { id: string }).id;

    const completeRes = await request(app.getHttpServer())
      .post(`/api/v1/meetings/${meetingId}/complete`)
      .send({
        skipTranscription: true,
      })
      .expect(201);

    expect((completeRes.body as { status: string }).status).toBe('processing');
  });
});
