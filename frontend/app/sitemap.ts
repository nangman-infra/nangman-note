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
      url: toAbsoluteUrl('/landing'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: toAbsoluteUrl('/landing/guide'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: toAbsoluteUrl('/landing/how-it-works'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: toAbsoluteUrl('/landing/use-cases'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: toAbsoluteUrl('/landing/start'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: toAbsoluteUrl('/auth/signin'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];
}
