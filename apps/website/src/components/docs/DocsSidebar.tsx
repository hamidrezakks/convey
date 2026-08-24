import { Activity, ChevronRight, Code2, Cpu, ExternalLink, Layers, Radio, Rocket, Server, Sliders } from 'lucide-react';
import type React from 'react';
import { type DocNavigationGroup, docNavigationGroups } from '../../docs-content';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/Badge';

export interface DocsSidebarProps {
  currentDocId: string;
  onSelectDoc: (id: string) => void;
  className?: string;
}

const iconMap: Record<string, React.ElementType> = {
  Rocket,
  Cpu,
  Sliders,
  Code2,
  Radio,
  Layers,
  Server,
  Activity,
};

export function DocsSidebar({ currentDocId, onSelectDoc, className }: DocsSidebarProps) {
  return (
    <aside className={cn('w-64 shrink-0 space-y-6', className)}>
      {docNavigationGroups.map((group: DocNavigationGroup) => (
        <div key={group.category} className="space-y-1.5">
          <h4 className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
            {group.category}
          </h4>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = item.id === currentDocId;
              const Icon = item.icon ? iconMap[item.icon] || ChevronRight : ChevronRight;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectDoc(item.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer group',
                    isActive
                      ? 'bg-sky-500/10 text-sky-400 font-semibold border border-sky-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60',
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={cn(
                        'w-3.5 h-3.5 shrink-0 transition-colors',
                        isActive ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-300',
                      )}
                    />
                    <span className="truncate">{item.title}</span>
                  </div>
                  {item.badge && (
                    <Badge
                      variant={isActive ? 'primary' : 'outline'}
                      size="sm"
                      className="text-[10px] py-0 px-1.5 shrink-0"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* External Resource Links */}
      <div className="pt-4 border-t border-slate-800 space-y-1.5">
        <h4 className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
          Interactive Consoles
        </h4>
        <a
          href="http://localhost:5173"
          target="_blank"
          rel="noreferrer"
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-sky-400 hover:bg-slate-800/60 transition-all group"
        >
          <span className="truncate">Mission Control UI</span>
          <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-sky-400" />
        </a>
        <a
          href="http://localhost:3000/swagger"
          target="_blank"
          rel="noreferrer"
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-sky-400 hover:bg-slate-800/60 transition-all group"
        >
          <span className="truncate">OpenAPI Swagger UI</span>
          <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-sky-400" />
        </a>
      </div>
    </aside>
  );
}
