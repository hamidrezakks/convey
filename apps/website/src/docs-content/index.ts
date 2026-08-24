import { apiReferenceDoc } from './api-reference';
import { architectureDoc } from './architecture';
import { benchmarksDoc } from './benchmarks';
import { configurationDoc } from './configuration';
import { deploymentDoc } from './deployment';
import { providersDoc } from './providers';
import { type DocSection, quickstartDoc } from './quickstart';
import { sdksDoc } from './sdks';

export * from './api-reference';
export * from './architecture';
export * from './benchmarks';
export * from './configuration';
export * from './deployment';
export * from './providers';
export * from './quickstart';
export * from './sdks';

export interface DocNavigationGroup {
  category: string;
  items: {
    id: string;
    title: string;
    badge?: string;
    icon?: string;
  }[];
}

export const docNavigationGroups: DocNavigationGroup[] = [
  {
    category: 'Getting Started',
    items: [
      { id: 'quickstart', title: 'Quickstart & Installation', badge: '2 min', icon: 'Rocket' },
      { id: 'architecture', title: 'Architecture & Guarantees', badge: 'Core', icon: 'Cpu' },
      { id: 'configuration', title: 'Configuration (.env)', icon: 'Sliders' },
    ],
  },
  {
    category: 'API & Providers',
    items: [
      { id: 'api-reference', title: 'REST API Specification', badge: 'OpenAPI 3.1', icon: 'Code2' },
      { id: 'providers', title: '88+ Turnkey Providers', badge: '88 Adapters', icon: 'Radio' },
      { id: 'sdks', title: 'SDKs & Client Libraries', icon: 'Layers' },
    ],
  },
  {
    category: 'Operations & Scaling',
    items: [
      { id: 'deployment', title: 'Docker & Kubernetes', icon: 'Server' },
      { id: 'benchmarks', title: 'Benchmarks & Stress Results', badge: '5.2M ops/s', icon: 'Activity' },
    ],
  },
];

export const allDocs: Record<string, DocSection> = {
  quickstart: quickstartDoc,
  architecture: architectureDoc,
  configuration: configurationDoc,
  'api-reference': apiReferenceDoc,
  providers: providersDoc,
  deployment: deploymentDoc,
  benchmarks: benchmarksDoc,
  sdks: sdksDoc,
};

export interface SearchResultItem {
  docId: string;
  docTitle: string;
  headingId?: string;
  headingTitle: string;
  snippet: string;
  category: string;
}

export function searchDocs(query: string): SearchResultItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results: SearchResultItem[] = [];

  for (const group of docNavigationGroups) {
    for (const item of group.items) {
      const doc = allDocs[item.id];
      if (!doc) continue;

      // Check title or description
      if (doc.title.toLowerCase().includes(q) || doc.description.toLowerCase().includes(q)) {
        results.push({
          docId: doc.id,
          docTitle: doc.title,
          headingTitle: doc.title,
          snippet: doc.description,
          category: group.category,
        });
      }

      // Check headings
      for (const h of doc.headings) {
        if (h.title.toLowerCase().includes(q)) {
          results.push({
            docId: doc.id,
            docTitle: doc.title,
            headingId: h.id,
            headingTitle: h.title,
            snippet: `Section in ${doc.title}`,
            category: group.category,
          });
        }
      }

      // Search in content lines
      const paragraphs = doc.content.split('\n\n');
      for (const p of paragraphs) {
        const clean = p.replace(/[#*`_[\]()]/g, '').trim();
        if (clean.toLowerCase().includes(q) && clean.length > 20) {
          // Find matching snippet
          const matchIdx = clean.toLowerCase().indexOf(q);
          const start = Math.max(0, matchIdx - 40);
          const end = Math.min(clean.length, matchIdx + q.length + 60);
          const snippetText = (start > 0 ? '...' : '') + clean.slice(start, end) + (end < clean.length ? '...' : '');

          // Avoid duplicate with existing result
          if (!results.some((r) => r.docId === doc.id && r.snippet === snippetText)) {
            results.push({
              docId: doc.id,
              docTitle: doc.title,
              headingTitle: doc.title,
              snippet: snippetText,
              category: group.category,
            });
          }
          if (results.length > 20) break;
        }
      }
    }
  }

  return results.slice(0, 15);
}
