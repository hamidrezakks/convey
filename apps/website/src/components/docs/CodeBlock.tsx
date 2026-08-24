import { Check, Copy, Terminal } from 'lucide-react';
import { useState } from 'react';
import { cn, copyToClipboard } from '../../lib/utils';

export interface CodeSnippet {
  language: string;
  label: string;
  code: string;
}

export interface CodeBlockProps {
  snippets?: CodeSnippet[];
  code?: string;
  language?: string;
  filename?: string;
  className?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({
  snippets,
  code,
  language = 'bash',
  filename,
  className,
  showLineNumbers = false,
}: CodeBlockProps) {
  const activeSnippets = snippets && snippets.length > 0 ? snippets : [{ language, label: language, code: code || '' }];
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const currentSnippet = activeSnippets[activeTab] || activeSnippets[0];

  const handleCopy = async () => {
    if (!currentSnippet) return;
    const success = await copyToClipboard(currentSnippet.code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const lines = currentSnippet.code.split('\n');

  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden border border-slate-800 bg-[#090d16] my-4 shadow-xl',
        className,
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs font-mono">
        <div className="flex items-center gap-2">
          {snippets && snippets.length > 1 ? (
            <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-slate-800">
              {snippets.map((snip, idx) => (
                <button
                  key={snip.label}
                  type="button"
                  onClick={() => setActiveTab(idx)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer',
                    idx === activeTab
                      ? 'bg-sky-500/10 text-sky-400 font-semibold border border-sky-500/30'
                      : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  {snip.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <Terminal className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-medium text-slate-300">{filename || currentSnippet.label}</span>
            </div>
          )}
        </div>

        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs font-medium cursor-pointer border border-slate-700/60 active:scale-95"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code contents */}
      <div className="overflow-x-auto p-4 text-xs font-mono leading-relaxed text-slate-200">
        <pre className="m-0">
          <code>
            {lines.map((line, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: line index is necessary for code rendering
              <div key={`line-${idx}-${line.slice(0, 10)}`} className="table-row">
                {showLineNumbers && (
                  <span className="table-cell pr-4 text-slate-600 select-none text-right">{idx + 1}</span>
                )}
                <span className="table-cell">{line || ' '}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
