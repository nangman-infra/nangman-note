import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, map } from 'rxjs';

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

const INTERNAL_RESPONSE_KEYS = new Set(['ownerSub']);

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T> | StreamableFile | undefined
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T> | StreamableFile | undefined> {
    if (context.getType() !== 'http') {
      return next.handle().pipe(
        map((data) => {
          if (data instanceof StreamableFile) {
            return data;
          }

          return {
            success: true,
            data: this.sanitizeResponseData(data ?? null) as T,
          };
        }),
      );
    }

    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        if (response.statusCode === 204 || response.statusCode === 304) {
          return undefined;
        }

        if (data instanceof StreamableFile) {
          return data;
        }

        return {
          success: true,
          data: this.sanitizeResponseData(data ?? null) as T,
        };
      }),
    );
  }

  private sanitizeResponseData(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (
      value instanceof Date ||
      value instanceof StreamableFile ||
      Buffer.isBuffer(value)
    ) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeResponseData(item));
    }

    if (typeof value !== 'object') {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !INTERNAL_RESPONSE_KEYS.has(key))
        .map(([key, entry]) => [key, this.sanitizeResponseData(entry)]),
    );
  }
}
