import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { source } from '@/lib/source';

export default function RootDocsLayout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: (
          <div className="flex items-center gap-2 font-display font-bold text-base text-fd-foreground">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-sky-500 fill-sky-500" />
            </div>
            <span className="tracking-tight">CONVEY</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-sky-500/10 text-sky-500 border border-sky-500/20 font-medium">
              Docs
            </span>
          </div>
        ),
      }}
      links={[
        { text: 'Home', url: '/' },
        { text: 'Mission Control', url: 'http://localhost:5173', external: true },
        { text: 'OpenAPI Spec', url: 'http://localhost:3000/swagger', external: true },
        { text: 'GitHub', url: 'https://github.com/hamidrezakks/convey', external: true },
      ]}
    >
      {children}
    </DocsLayout>
  );
}
