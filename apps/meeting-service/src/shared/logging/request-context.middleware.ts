import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { runWithRequestContext } from './request-context.storage';

export function requestContextMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const requestIdHeader = request.header('x-request-id');
  const requestId =
    typeof requestIdHeader === 'string' && requestIdHeader.trim().length > 0
      ? requestIdHeader.trim()
      : randomUUID();

  response.setHeader('x-request-id', requestId);

  runWithRequestContext(
    {
      requestId,
      transport: 'http',
      method: request.method,
      path: request.originalUrl || request.url,
      ip: request.ip,
      userAgent: request.header('user-agent') ?? undefined,
    },
    next,
  );
}
