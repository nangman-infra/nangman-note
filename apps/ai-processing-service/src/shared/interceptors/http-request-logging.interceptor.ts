import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';
import type { AuthUser } from '../auth/auth-user.interface';
import { StructuredLogger } from '../logging/structured-logger';
import { updateRequestContext } from '../logging/request-context.storage';

@Injectable()
export class HttpRequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new StructuredLogger(
    HttpRequestLoggingInterceptor.name,
  );

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      method: string;
      originalUrl?: string;
      url?: string;
      user?: AuthUser;
    }>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = process.hrtime.bigint();

    updateRequestContext({
      ownerSub: request.user?.sub,
      method: request.method,
      path: request.originalUrl || request.url,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
          this.logger.log('http.request.completed', {
            statusCode: response.statusCode,
            durationMs: Number(durationMs.toFixed(2)),
          });
        },
      }),
    );
  }
}
