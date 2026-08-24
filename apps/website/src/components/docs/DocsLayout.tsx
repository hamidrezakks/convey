import { ArrowLeft, ArrowRight, Bookmark, ChevronRight, Hash } from 'lucide-react';
import { allDocs, type DocSection, docNavigationGroups } from '../../docs-content';
import { Badge } from '../ui/Badge';
import { Callout } from './Callout';
import { CodeBlock } from './CodeBlock';
import { DocsSidebar } from './DocsSidebar';
import { TableOfContents } from './TableOfContents';

export interface DocsLayoutProps {
  currentDocId: string;
  onSelectDoc: (id: string) => void;
  onNavigateHome: () => void;
}

export function DocsLayout({ currentDocId, onSelectDoc, onNavigateHome }: DocsLayoutProps) {
  const doc: DocSection = allDocs[currentDocId] || allDocs.quickstart;

  // Flatten all items for previous/next navigation
  const flatItems = docNavigationGroups.flatMap((g) => g.items);
  const currentIndex = flatItems.findIndex((i) => i.id === currentDocId);
  const prevItem = currentIndex > 0 ? flatItems[currentIndex - 1] : null;
  const nextItem = currentIndex < flatItems.length - 1 ? flatItems[currentIndex + 1] : null;

  // Render markdown content blocks into rich interactive components
  const renderContent = (content: string) => {
    const sections = content.split('\n\n');
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i].trim();
      if (!section) continue;

      // Handle Code block fences
      if (section.startsWith('```')) {
        const lines = section.split('\n');
        const firstLine = lines[0];
        const lang = firstLine.replace('```', '').trim() || 'bash';
        const code = lines.slice(1, lines[lines.length - 1].startsWith('```') ? -1 : undefined).join('\n');
        elements.push(
          <CodeBlock
            key={`code-${i}`}
            code={code}
            language={lang}
            filename={
              lang === 'bash'
                ? 'Terminal'
                : lang === 'typescript'
                  ? 'example.ts'
                  : lang === 'yaml'
                    ? 'deployment.yaml'
                    : lang
            }
          />,
        );
        continue;
      }

      // Handle H2 Headings
      if (section.startsWith('## ')) {
        const title = section.replace('## ', '').trim();
        const headingObj = doc.headings.find((h) => h.title === title || title.includes(h.title));
        const anchorId = headingObj
          ? headingObj.id
          : title
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/[\s_-]+/g, '-');

        elements.push(
          <div key={`h2-${i}`} className="pt-8 pb-3 group">
            <h2
              id={anchorId}
              className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2.5 font-display scroll-mt-24"
            >
              <a
                href={`#${anchorId}`}
                className="opacity-0 group-hover:opacity-100 text-sky-400 hover:text-sky-300 transition-opacity -ml-6 pr-2"
                title="Direct link to this heading"
              >
                <Hash className="w-4 h-4" />
              </a>
              <span>{title}</span>
            </h2>
          </div>,
        );
        continue;
      }

      // Handle H3 Headings
      if (section.startsWith('### ')) {
        const title = section.replace('### ', '').trim();
        const headingObj = doc.headings.find((h) => h.title === title || title.includes(h.title));
        const anchorId = headingObj
          ? headingObj.id
          : title
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/[\s_-]+/g, '-');

        elements.push(
          <div key={`h3-${i}`} className="pt-6 pb-2 group">
            <h3 id={anchorId} className="text-lg font-semibold text-sky-200 flex items-center gap-2 scroll-mt-24">
              <a
                href={`#${anchorId}`}
                className="opacity-0 group-hover:opacity-100 text-sky-400 hover:text-sky-300 transition-opacity -ml-5 pr-2"
                title="Direct link to this heading"
              >
                <Hash className="w-3.5 h-3.5" />
              </a>
              <span>{title}</span>
            </h3>
          </div>,
        );
        continue;
      }

      // Handle Callouts / Blockquotes
      if (section.startsWith('> ')) {
        const calloutText = section.replace(/^>\s*/gm, '').trim();
        let calloutType: 'note' | 'tip' | 'important' | 'warning' | 'security' = 'note';
        let cleanText = calloutText;

        if (calloutText.toLowerCase().includes('note:')) {
          calloutType = 'note';
          cleanText = calloutText.replace(/^Note:\s*/i, '');
        } else if (calloutText.toLowerCase().includes('tip:')) {
          calloutType = 'tip';
          cleanText = calloutText.replace(/^Tip:\s*/i, '');
        } else if (calloutText.toLowerCase().includes('warning:')) {
          calloutType = 'warning';
          cleanText = calloutText.replace(/^Warning:\s*/i, '');
        } else if (calloutText.toLowerCase().includes('security:')) {
          calloutType = 'security';
          cleanText = calloutText.replace(/^Security:\s*/i, '');
        }

        elements.push(
          <Callout key={`callout-${i}`} type={calloutType}>
            <p>{cleanText}</p>
          </Callout>,
        );
        continue;
      }

      // Handle Markdown Tables
      if (section.includes('|') && section.includes('---')) {
        const rows = section
          .split('\n')
          .map((r) => r.trim())
          .filter(Boolean);
        const headerRow = rows[0]
          .split('|')
          .map((c) => c.trim())
          .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        const bodyRows = rows.slice(2).map((r) =>
          r
            .split('|')
            .map((c) => c.trim())
            .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1),
        );

        elements.push(
          <div key={`table-${i}`} className="my-6 overflow-x-auto rounded-xl border border-slate-800 bg-[#090d16]/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 font-mono text-slate-300">
                  {headerRow.map((h) => (
                    <th key={`th-${h}`} className="py-3 px-4 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {bodyRows.map((row) => (
                  <tr key={`tr-${row.join('-')}`} className="hover:bg-slate-800/30 transition-colors">
                    {row.map((cell, cellIdx) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: cell column index is appropriate for table columns
                      <td key={`td-${cellIdx}-${cell.slice(0, 8)}`} className="py-3 px-4 text-slate-300">
                        {cell.startsWith('`') && cell.endsWith('`') ? (
                          <code className="text-sky-300 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20 font-mono">
                            {cell.slice(1, -1)}
                          </code>
                        ) : cell.includes('**') ? (
                          <strong className="text-slate-100">{cell.replace(/\*\*/g, '')}</strong>
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        continue;
      }

      // Standard Paragraph
      elements.push(
        <p key={`p-${i}`} className="text-sm sm:text-base text-slate-300 leading-relaxed my-3 font-normal">
          {section}
        </p>,
      );
    }

    return elements;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb Bar */}
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-6 font-mono">
        <button type="button" onClick={onNavigateHome} className="hover:text-sky-400 transition-colors cursor-pointer">
          Convey
        </button>
        <ChevronRight className="w-3 h-3 text-slate-600" />
        <span className="text-slate-400">Documentation</span>
        <ChevronRight className="w-3 h-3 text-slate-600" />
        <span className="text-sky-400 font-medium">{doc.title}</span>
      </div>

      {/* 3-Column Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Navigation Sidebar */}
        <div className="lg:col-span-3 hidden lg:block sticky top-24">
          <DocsSidebar currentDocId={currentDocId} onSelectDoc={onSelectDoc} />
        </div>

        {/* Center Main Content Area */}
        <main className="lg:col-span-6 min-w-0">
          {/* Header */}
          <div className="pb-6 mb-8 border-b border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="primary" size="sm">
                <Bookmark className="w-3 h-3" />
                <span>Reference Guide</span>
              </Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-display tracking-tight">{doc.title}</h1>
            <p className="text-base sm:text-lg text-slate-400 leading-relaxed font-normal">{doc.description}</p>
          </div>

          {/* Rendered Document Body */}
          <div className="prose prose-invert max-w-none space-y-4">{renderContent(doc.content)}</div>

          {/* Previous / Next Article Navigation Footer */}
          <div className="mt-16 pt-8 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {prevItem ? (
              <button
                type="button"
                onClick={() => onSelectDoc(prevItem.id)}
                className="flex items-center gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800/80 hover:border-slate-700 transition-all text-left group cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 text-slate-500 group-hover:text-sky-400 group-hover:-translate-x-1 transition-all shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] font-mono uppercase text-slate-500">Previous</div>
                  <div className="text-sm font-semibold text-slate-200 group-hover:text-sky-300 truncate">
                    {prevItem.title}
                  </div>
                </div>
              </button>
            ) : (
              <div />
            )}

            {nextItem ? (
              <button
                type="button"
                onClick={() => onSelectDoc(nextItem.id)}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800/80 hover:border-slate-700 transition-all text-right group cursor-pointer"
              >
                <div className="min-w-0 text-left">
                  <div className="text-[11px] font-mono uppercase text-slate-500">Next</div>
                  <div className="text-sm font-semibold text-slate-200 group-hover:text-sky-300 truncate">
                    {nextItem.title}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-1 transition-all shrink-0" />
              </button>
            ) : (
              <div />
            )}
          </div>
        </main>

        {/* Right Sticky Table of Contents */}
        <div className="lg:col-span-3 hidden lg:block">
          <TableOfContents headings={doc.headings} />
        </div>
      </div>
    </div>
  );
}
