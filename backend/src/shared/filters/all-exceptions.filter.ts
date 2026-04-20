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
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.resolveMessage(exception, statusCode);
    updateRequestContext({
      method: request.method,
      path: request.originalUrl || request.url,
    });
    this.logger.error('http.request.failed', exception, {
      statusCode,
      code: this.resolveCode(exception),
    });

    const payload: ApiErrorResponse = {
      success: false,
      error: {
        code: this.resolveCode(exception),
        statusCode,
        message,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    };

    response.status(statusCode).json(payload);
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
