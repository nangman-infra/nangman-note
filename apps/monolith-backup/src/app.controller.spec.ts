import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppHealthStatus, AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  const health: AppHealthStatus = {
    status: 'ok',
    database: 'up',
    timestamp: '2026-01-01T00:00:00.000Z',
  };
  const appServiceMock: Pick<AppService, 'getHello' | 'getHealth'> = {
    getHello: jest.fn(() => 'Hello World!'),
    getHealth: jest.fn(() => Promise.resolve(health)),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: appServiceMock,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });

    it('should return health status', async () => {
      await expect(appController.getHealth()).resolves.toEqual(health);
    });
  });
});
