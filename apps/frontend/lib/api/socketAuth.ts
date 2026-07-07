interface MessageCarrier {
  message?: unknown;
}

const AUTH_ERROR_PATTERNS = [
  'authentication expired',
  'invalid access token',
  'missing socket auth token',
  'missing access token',
] as const;

export function extractSocketErrorMessage(payload: unknown): string | undefined {
  if (typeof payload === 'string') {
    const normalized = payload.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  if (payload instanceof Error) {
    const normalized = payload.message.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  if (payload && typeof payload === 'object') {
    const message = (payload as MessageCarrier).message;
    if (typeof message === 'string') {
      const normalized = message.trim();
      return normalized.length > 0 ? normalized : undefined;
    }
  }

  return undefined;
}

export function isSocketAuthError(payload: unknown): boolean {
  const message = extractSocketErrorMessage(payload);
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return AUTH_ERROR_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  );
}
