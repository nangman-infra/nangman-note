import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Prompt Flow (e2e)', () => {
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

  it('lists seeded default prompts and supports CRUD for user prompts', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/prompts')
      .expect(200);

    const listBody = listRes.body as {
      default: Array<{ id: string; isDefault: boolean }>;
      user: Array<{ id: string; isDefault: boolean }>;
    };

    expect(listBody.default.length).toBeGreaterThanOrEqual(3);
    expect(listBody.default.map((prompt) => prompt.id).sort()).toEqual(
      expect.arrayContaining([
        'prompt_default_meeting',
        'prompt_default_lecture',
        'prompt_default_seminar',
      ]),
    );
    expect(listBody.default.every((prompt) => prompt.isDefault)).toBe(true);

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/prompts')
      .send({
        name: '  사용자 프롬프트  ',
        content: '  사용자 정의 내용  ',
      })
      .expect(201);

    const created = createRes.body as {
      id: string;
      name: string;
      content: string;
      isDefault: boolean;
    };

    expect(created.id.startsWith('prompt_user_')).toBe(true);
    expect(created.name).toBe('사용자 프롬프트');
    expect(created.content).toBe('사용자 정의 내용');
    expect(created.isDefault).toBe(false);

    const updateRes = await request(app.getHttpServer())
      .put(`/api/v1/prompts/${created.id}`)
      .send({
        name: '  수정 이름  ',
      })
      .expect(200);

    expect((updateRes.body as { name: string }).name).toBe('수정 이름');

    await request(app.getHttpServer())
      .delete(`/api/v1/prompts/${created.id}`)
      .expect(204);
  });

  it('rejects updates to default prompts', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/prompts/prompt_default_meeting')
      .send({
        name: '수정 시도',
      })
      .expect(400);
  });
});
