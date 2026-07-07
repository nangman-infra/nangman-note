import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TransNote',
    short_name: 'TransNote',
    description: '실시간 전사와 노트 중심 워크플로우를 결합한 회의 기록 워크스페이스',
    start_url: '/',
    display: 'standalone',
    background_color: '#020409',
    theme_color: '#08131f',
    lang: 'ko',
    categories: ['business', 'productivity', 'utilities'],
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
