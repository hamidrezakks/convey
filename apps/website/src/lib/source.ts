import { loader } from 'fumadocs-core/source';
import { docs, meta } from '../../.source/server';

export const source = loader({
  baseUrl: '/docs',
  source: {
    files: [
      ...docs.map((d) => ({
        type: 'page' as const,
        path: (d as { info: { path: string } }).info.path,
        data: d as unknown as Record<string, unknown>,
      })),
      ...meta.map((m) => ({
        type: 'meta' as const,
        path: (m as { info: { path: string } }).info.path,
        data: m as unknown as Record<string, unknown>,
      })),
    ],
  },
});
