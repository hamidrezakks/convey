import { List } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

export interface HeadingItem {
  id: string;
  title: string;
  level: number;
}

export interface TableOfContentsProps {
  headings: HeadingItem[];
}

export function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (!headings.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      {
        rootMargin: '0px 0px -70% 0px',
        threshold: 0.1,
      },
    );

    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (!headings.length) return null;

  return (
    <div className="sticky top-24 space-y-3 p-4 rounded-xl border border-slate-800/80 bg-[#090d16]/70 backdrop-blur-md">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <List className="w-3.5 h-3.5 text-sky-400" />
        <span>On this page</span>
      </div>

      <nav className="space-y-1 text-xs">
        {headings.map((h) => {
          const isActive = activeId === h.id;
          return (
            <a
              key={h.id}
              href={`#${h.id}`}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(h.id);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                  setActiveId(h.id);
                  history.pushState(null, '', `#${h.id}`);
                }
              }}
              className={cn(
                'block py-1 transition-all rounded px-2',
                h.level === 3 ? 'pl-4 text-slate-500' : '',
                isActive
                  ? 'text-sky-400 font-medium bg-sky-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50',
              )}
            >
              {h.title}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
