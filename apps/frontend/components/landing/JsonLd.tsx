import { getSiteUrl } from '@/lib/seo/site-url';

/**
 * 랜딩 페이지용 JSON-LD 구조화 데이터.
 * SoftwareApplication + Organization 스키마로 검색엔진에 제품 정보를 전달한다.
 */
export function LandingJsonLd() {
  const siteUrl = getSiteUrl().toString().replace(/\/$/, '');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: '낭만 인프라',
        url: siteUrl,
        logo: `${siteUrl}/icon`,
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${siteUrl}/landing/#app`,
        name: 'TransNote',
        description:
          '실시간 전사와 노트를 결합해 AI가 주제를 분리하고 구조화된 회의록을 자동 생성하는 워크스페이스',
        url: `${siteUrl}/landing`,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'KRW',
        },
        featureList: [
          '실시간 음성 전사',
          '7개 언어 자동 감지',
          '최대 8명 화자 분리',
          'AI 구조화 회의록 생성',
          '회의 · 강의 · 멘토링 문서 타입',
          'PDF · DOCX · Markdown 내보내기',
          'WYSIWYG 편집기',
          '커스텀 프롬프트',
        ],
        provider: {
          '@type': 'Organization',
          '@id': `${siteUrl}/#organization`,
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: 'TransNote',
        publisher: {
          '@type': 'Organization',
          '@id': `${siteUrl}/#organization`,
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
