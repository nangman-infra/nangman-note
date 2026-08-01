import { inspect } from 'util';
import { getRequestContext } from './request-context.storage';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogMeta = Record<string, unknown>;

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function normalizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return compact({
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
    });
  }

  return {
    errorMessage:
      typeof error === 'string' ? error : inspect(error, { depth: 3 }),
  };
}

export class StructuredLogger {
  constructor(private readonly context: string) {}

  log(event: string, meta?: LogMeta): void {
    this.write('info', event, meta);
  }

  debug(event: string, meta?: LogMeta): void {
    this.write('debug', event, meta);
  }

  warn(event: string, meta?: LogMeta): void {
    this.write('warn', event, meta);
  }

  error(event: string, error: unknown, meta?: LogMeta): void {
    this.write('error', event, meta, error);
  }

  private write(
    level: LogLevel,
    event: string,
    meta?: LogMeta,
    error?: unknown,
  ): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const requestContext = getRequestContext();
    const payload = compact({
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      event,
      requestId: requestContext?.requestId,
      transport: requestContext?.transport,
      ownerSub: requestContext?.ownerSub,
      meetingId: requestContext?.meetingId,
      jobId: requestContext?.jobId,
      socketId: requestContext?.socketId,
      method: requestContext?.method,
      path: requestContext?.path,
      ip: requestContext?.ip,
      userAgent: requestContext?.userAgent,
      ...compact(meta ?? {}),
      ...(error ? normalizeError(error) : {}),
    });

    const line = JSON.stringify(payload);
    if (level === 'warn' || level === 'error') {
      process.stderr.write(`${line}\n`);
      return;
    }

    process.stdout.write(`${line}\n`);
  }
}
