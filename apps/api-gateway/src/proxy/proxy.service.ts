import { Injectable, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

/**
 * MSA 라우팅 규칙
 * /api/v1/meetings/* → meeting-service
 * /api/v1/meetings/:id/note → note-service
 * /api/v1/meetings/:id/result → meeting-service
 * /api/v1/transcription/* → ai-processing-service
 * /api/v1/user-settings → meeting-service
 * /api/v1/prompts → meeting-service
 */
const MEETING_SERVICE = process.env.MEETING_SERVICE_URL
  ? `http://${process.env.MEETING_SERVICE_URL}`
  : 'http://meeting-service-svc:3002';

const NOTE_SERVICE = process.env.NOTE_SERVICE_URL
  ? `http://${process.env.NOTE_SERVICE_URL}`
  : 'http://note-service-svc:3001';

const AI_SERVICE = process.env.AI_PROCESSING_SERVICE_URL
  ? `http://${process.env.AI_PROCESSING_SERVICE_URL}`
  : 'http://ai-processing-service-svc:3003';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  /**
   * path 기준으로 어느 MSA 서비스로 프록시할지 결정
   */
  private resolveTarget(path: string): string {
    const fullPath = `/api/v1/${path}`;

    // /api/v1/meetings/:id/note → note-service
    if (/^\/api\/v1\/meetings\/[^/]+\/note/.test(fullPath)) {
      return NOTE_SERVICE;
    }

    // /api/v1/transcription/* → ai-processing-service
    if (fullPath.startsWith('/api/v1/transcription')) {
      return AI_SERVICE;
    }

    // 나머지 /api/v1/* → meeting-service (meetings, prompts, user-settings, result, document-output)
    return MEETING_SERVICE;
  }

  async forward(req: Request, res: Response, path: string): Promise<void> {
    const target = this.resolveTarget(path);
    this.logger.log(`Proxying ${req.method} /api/v1/${path} → ${target}`);

    const proxy = createProxyMiddleware({
      target,
      changeOrigin: true,
      on: {
        error: (err, _req, proxyRes) => {
          this.logger.error(`Proxy error: ${err.message}`);
          if (!res.headersSent) {
            (proxyRes as Response).status(502).json({
              statusCode: 502,
              message: 'Bad Gateway: upstream service unavailable',
            });
          }
        },
      },
    });

    return new Promise((resolve) => {
      proxy(req, res, () => resolve());
    });
  }
}
