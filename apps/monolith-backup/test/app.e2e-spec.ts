import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { applyE2eAppConfig } from './apply-e2e-app-config';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let originalNodeEnv: string | undefined;

  beforeEach(async () => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyE2eAppConfig(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect({
      success: true,
      data: 'Hello World!',
    });
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          data: {
            status: string;
            database: string;
            timestamp: unknown;
          };
        };
        expect(body.data).toMatchObject({
          status: 'ok',
          database: 'up',
        });
        expect(typeof body.data.timestamp).toBe('string');
      });
  });
});
