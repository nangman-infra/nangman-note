import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextStore {
  requestId: string;
  transport?: 'http' | 'ws' | 'job';
  ownerSub?: string;
  meetingId?: string;
  jobId?: string;
  socketId?: string;
  method?: string;
  path?: string;
  ip?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

export function runWithRequestContext<T>(
  nextContext: Partial<RequestContextStore>,
  callback: () => T,
): T {
  const current = storage.getStore();
  const context: RequestContextStore = {
    requestId: nextContext.requestId ?? current?.requestId ?? randomUUID(),
    ...compact(current ?? {}),
    ...compact(nextContext),
  };

  return storage.run(context, callback);
}

export function getRequestContext(): RequestContextStore | undefined {
  const current = storage.getStore();
  return current ? { ...current } : undefined;
}

export function updateRequestContext(
  patch: Partial<RequestContextStore>,
): void {
  const current = storage.getStore();
  if (!current) {
    return;
  }

  Object.assign(current, compact(patch));
}

