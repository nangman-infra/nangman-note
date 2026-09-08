import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { StructuredLogger } from '../logging/structured-logger';
import { updateRequestContext } from '../logging/request-context.storage';

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    statusCode: number;
    message: string;
    path: string;
    timestamp: string;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new StructuredLogger(AllExceptionsFilter.name);

  constructor(
    private readonly nodeEnv: string = process.env.NODE_ENV ?? 'development',
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // 글로벌 필터는 WS/RPC 컨텍스트의 예외도 받을 수 있다. HTTP 응답 객체가 없는 곳에서
    // response.status() 를 호출하면 2차 크래시가 나므로 로그만 남기고 끝낸다.
    if (host.getType() !== 'http') {
      this.logger.error('request.failed', exception, {
        transport: host.getType(),
        code: this.resolveCode(exception),
      });
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.resolveMessage(exception, statusCode);
    const code = this.resolveCode(exception);
    updateRequestContext({
      method: request.method,
      path: request.originalUrl || request.url,
    });
    this.logFailure(exception, statusCode, code, message);

    const payload: ApiErrorResponse = {
      success: false,
      error: {
        code,
        statusCode,
        message,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    };

    if (response.headersSent) {
      return;
    }
    response.status(statusCode).json(payload);
  }

  /**
   * 5xx 는 서버 결함이므로 스택 포함 error 레벨.
   * 4xx 는 클라이언트 상태(만료 토큰, 잘못된 입력 등)라 정상 운영 중에도 흔하다 —
   * 스택 없이 warn 으로 남겨 실제 장애 신호가 묻히지 않게 한다.
   */
  private logFailure(
    exception: unknown,
    statusCode: number,
    code: string,
    message: string,
  ): void {
    if (statusCode >= 500) {
      this.logger.error('http.request.failed', exception, { statusCode, code });
      return;
    }

    this.logger.warn('http.request.rejected', {
      statusCode,
      code,
      errorMessage: message,
    });
  }

  private resolveMessage(exception: unknown, statusCode: number): string {
    if (this.nodeEnv === 'production' && statusCode >= 500) {
      return 'Internal server error';
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return response;
      }

      if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response
      ) {
        const message = (response as { message?: unknown }).message;

        if (Array.isArray(message)) {
          return message.join(', ');
        }

        if (typeof message === 'string') {
          return message;
        }
      }

      return exception.message;
    }

    if (this.nodeEnv === 'production' || statusCode >= 500) {
      return 'Internal server error';
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'Internal server error';
  }

  private resolveCode(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (
        typeof response === 'object' &&
        response !== null &&
        'code' in response &&
        typeof (response as { code?: unknown }).code === 'string'
      ) {
        return (response as { code: string }).code;
      }

      return exception.name;
    }

    if (exception instanceof Error) {
      return exception.name || 'Error';
    }

    return 'InternalServerError';
  }
}
