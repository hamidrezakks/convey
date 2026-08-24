import { createSearchAPI } from 'fumadocs-core/search/server';
import { source } from '@/lib/source';

interface DocMetadata {
  title?: string;
  description?: string;
  structuredData?: unknown;
}

export const { GET } = createSearchAPI('advanced', {
  indexes: source.getPages().map((page) => {
    const data = page.data as unknown as DocMetadata;
    return {
      title: data.title || page.slugs.join(' ') || 'Convey Documentation',
      description: data.description || '',
      structuredData: data.structuredData as never,
      id: page.url,
      url: page.url,
    };
  }),
});
