import type { NextConfig } from 'next';

const backendUrl = process.env.BACKEND_URL || 'http://localhost:9999';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // REST API 프록시: /api/* → 백엔드
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      // WebSocket 프록시: /ws/* → 백엔드
      // socket.io HTTP polling은 이 rewrite를 통해 프록시됩니다.
      // WebSocket upgrade는 프로덕션 환경에서 리버스 프록시(nginx/ALB)가 처리합니다.
      {
        source: '/ws/:path*',
        destination: `${backendUrl}/ws/:path*`,
      },
    ];
  },
};

export default nextConfig;