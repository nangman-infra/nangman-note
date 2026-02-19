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
            data: (data ?? null) as T,
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
          data: (data ?? null) as T,
        };
      }),
    );
  }
}
