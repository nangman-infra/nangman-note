import type { MetadataRoute } from 'next';
import { toAbsoluteUrl } from '@/lib/seo/site-url';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: toAbsoluteUrl('/'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: toAbsoluteUrl('/auth/signin'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];
}
