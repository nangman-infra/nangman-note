import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  // AWS SDK는 standalone 빌드 시 네이티브 모듈 포함을 위해 외부 패키지로 처리
  serverExternalPackages: [
    '@aws-sdk/client-secrets-manager',
    '@aws-sdk/credential-providers',
  ],
};

export default nextConfig;
