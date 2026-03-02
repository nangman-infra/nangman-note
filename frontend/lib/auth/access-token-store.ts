let accessToken: string | undefined;

export function setAccessToken(token?: string): void {
  accessToken = token;
}

export function getAccessToken(): string | undefined {
  return accessToken;
}

