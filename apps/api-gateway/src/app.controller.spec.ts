import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { ProxyService } from './proxy/proxy.service';
import { HttpModule } from '@nestjs/axios';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      controllers: [AppController],
      providers: [ProxyService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return health status', () => {
      expect(appController.health()).toEqual({ status: 'ok', service: 'api-gateway' });
    });
  });
});
