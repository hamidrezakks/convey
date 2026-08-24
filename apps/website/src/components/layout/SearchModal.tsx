import { ArrowRight, CornerDownLeft, FileText, Hash, Layers, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type SearchResultItem, searchDocs } from '../../docs-content';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/Badge';

export interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult: (docId: string, headingId?: string) => void;
}

export function SearchModal({ isOpen, onClose, onSelectResult }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results: SearchResultItem[] = searchDocs(query);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        const item = results[selectedIndex];
        onSelectResult(item.docId, item.headingId);
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onSelectResult, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-[#090d16] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden glass-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 gap-3">
          <Search className="w-5 h-5 text-sky-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search documentation, API routes, architecture, providers..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none font-medium"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="text-slate-500 hover:text-slate-300 p-1">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block text-[10px] font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {results.length > 0 ? (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  // biome-ignore lint/suspicious/noArrayIndexKey: search result position index
                  key={`${item.docId}-${item.headingId || ''}-${idx}`}
                  type="button"
                  onClick={() => {
                    onSelectResult(item.docId, item.headingId);
                    onClose();
                  }}
                  className={cn(
                    'w-full flex items-start justify-between p-3 rounded-xl text-left transition-all cursor-pointer group',
                    isSelected
                      ? 'bg-sky-500/10 border border-sky-500/30'
                      : 'hover:bg-slate-800/50 border border-transparent',
                  )}
                >
                  <div className="space-y-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      {item.headingId ? (
                        <Hash className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-sky-300">
                        {item.headingTitle}
                      </span>
                      <Badge variant="outline" size="sm" className="text-[10px] py-0 px-1.5">
                        {item.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1">{item.snippet}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0 pt-1">
                    <span className="font-mono text-[11px]">{item.docTitle}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              );
            })
          ) : query ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Layers className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm">No documentation matching "{query}"</p>
              <p className="text-xs text-slate-500">Try searching for outbox, encryption, twilio, drr, or redis.</p>
            </div>
          ) : (
            <div className="p-4 text-xs text-slate-500 space-y-3">
              <div className="font-semibold text-slate-400 uppercase tracking-wider font-mono text-[10px]">
                Suggested Queries
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  'Quickstart',
                  'Transactional Outbox',
                  'Range Partitioning',
                  'AES-256-GCM',
                  'DRR Multi-Tenant',
                  'WhatsApp Session',
                  'SendGrid vs SES',
                  'Docker Deployment',
                  'Murmur32v3 Benchmarks',
                ].map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setQuery(term)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-750 text-slate-300 text-xs border border-slate-700/60 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-t border-slate-800 text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">↑</kbd>
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">↓</kbd> to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">↵</kbd> to select
            </span>
          </div>
          <div className="flex items-center gap-1 text-sky-400">
            <CornerDownLeft className="w-3 h-3" />
            <span>Search Convey</span>
          </div>
        </div>
      </div>
    </div>
  );
}
