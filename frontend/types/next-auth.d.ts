import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    accessToken?: string;
    /** access token 만료 시각 (epoch ms). 클라이언트가 만료 임박 토큰을 미리 폐기하는 데 사용 */
    accessTokenExpires?: number;
    error?: 'RefreshAccessTokenError';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    accessTokenExpires?: number;
    refreshToken?: string;
    error?: 'RefreshAccessTokenError';
  }
}
