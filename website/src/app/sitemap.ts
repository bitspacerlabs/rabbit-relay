import { source } from '@/lib/source';
import type { MetadataRoute } from 'next';

const baseUrl = 'https://bitspacerlabs.github.io/rabbit-relay';

export const revalidate = false;

export default function sitemap(): MetadataRoute.Sitemap {
  const docs = source.getPages().map((page) => ({
    url: `${baseUrl}${page.url}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    ...docs,
  ];
}
