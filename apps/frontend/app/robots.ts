import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo/site-url';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  const origin = siteUrl.origin;

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow: ['/api/', '/ws/', '/meeting/', '/settings/'],
      },
    ],
    sitemap: [`${origin}/sitemap.xml`],
    host: origin,
  };
}
