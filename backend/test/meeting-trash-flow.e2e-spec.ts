import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Meeting Trash Flow (e2e)', () => {
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

  it('supports soft delete, restore and permanent delete', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/meetings')
      .send({
        title: 'trash flow meeting',
        transcriptionMode: 'batch',
      })
      .expect(201);

    const meetingId = (createRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .delete(`/api/v1/meetings/${meetingId}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/meetings/${meetingId}`)
      .expect(404);

    const trashRes = await request(app.getHttpServer())
      .get('/api/v1/meetings/trash')
      .expect(200);
    const trashMeetings = (trashRes.body as { meetings: Array<{ id: string }> })
      .meetings;
    expect(trashMeetings.map((meeting) => meeting.id)).toContain(meetingId);

    await request(app.getHttpServer())
      .post(`/api/v1/meetings/${meetingId}/restore`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/meetings/${meetingId}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/meetings/${meetingId}`)
      .expect(204);

    await request(app.getHttpServer())
      .delete(`/api/v1/meetings/${meetingId}/permanent`)
      .expect(204);

    await request(app.getHttpServer())
      .post(`/api/v1/meetings/${meetingId}/restore`)
      .expect(404);
  });
});
