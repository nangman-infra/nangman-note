import { All, Controller, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProxyService } from './proxy/proxy.service';


@Controller()
export class AppController {
  constructor(private readonly proxyService: ProxyService) {}

  @All('health')
  health() {
    return { status: 'ok', service: 'api-gateway' };
  }

  // /api/v1/* → 각 MSA 서비스로 프록시
  @All('api/v1/*path')
  async proxy(
    @Param('path') path: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.proxyService.forward(req, res, path);
  }
}
