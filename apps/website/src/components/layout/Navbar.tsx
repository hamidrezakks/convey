import { Activity, BookOpen, ExternalLink, Menu, Radio, Search, Sparkles, Terminal, X, Zap } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/Button';

export interface NavbarProps {
  onOpenSearch: () => void;
  onNavigateHome: () => void;
  onNavigateDocs: (docId?: string) => void;
  isDocsView?: boolean;
}

export function Navbar({ onOpenSearch, onNavigateHome, onNavigateDocs, isDocsView }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#070b12]/80 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand / Logo */}
        <div className="flex items-center gap-6">
          <button type="button" onClick={onNavigateHome} className="flex items-center gap-2.5 group cursor-pointer">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 via-cyan-400 to-indigo-500 p-0.5 shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-sky-400 fill-sky-400" />
              </div>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-base font-extrabold tracking-tight text-white font-display">CONVEY</span>
              <span className="text-[9px] font-mono font-medium tracking-widest text-sky-400 uppercase -mt-0.5">
                Communication Engine
              </span>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-medium text-slate-300">
            <button
              type="button"
              onClick={() => onNavigateDocs('quickstart')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                isDocsView
                  ? 'text-sky-400 bg-sky-500/10 font-semibold border border-sky-500/30'
                  : 'hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Docs</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (isDocsView) onNavigateDocs('architecture');
                else {
                  document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>Architecture</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (isDocsView) onNavigateHome();
                setTimeout(() => {
                  document.getElementById('playground')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-purple-400" />
              <span>Playground</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (isDocsView) onNavigateDocs('providers');
                else {
                  document.getElementById('providers')?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>88+ Providers</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (isDocsView) onNavigateDocs('benchmarks');
                else {
                  document.getElementById('benchmarks')?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Benchmarks</span>
            </button>
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Search Trigger Button */}
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 transition-all cursor-pointer group shadow-inner"
          >
            <Search className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 transition-colors" />
            <span className="hidden sm:inline">Search docs...</span>
            <kbd className="text-[10px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
              ⌘K
            </kbd>
          </button>

          {/* GitHub Repo */}
          <a
            href="https://github.com/convey/convey"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4 fill-current text-slate-400" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span>GitHub</span>
          </a>

          {/* Mission Control CTA */}
          <a href="http://localhost:5173" target="_blank" rel="noreferrer" className="hidden sm:block">
            <Button size="sm" variant="glow" rightIcon={<ExternalLink className="w-3 h-3" />} className="text-xs">
              Mission Control
            </Button>
          </a>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-[#090d16] px-4 py-4 space-y-2 animate-in slide-in-from-top-2">
          <button
            type="button"
            onClick={() => {
              onNavigateDocs('quickstart');
              setMobileMenuOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800"
          >
            <BookOpen className="w-4 h-4 text-sky-400" />
            <span>Documentation</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigateDocs('architecture');
              setMobileMenuOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800"
          >
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>Architecture & Outbox</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigateDocs('providers');
              setMobileMenuOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800"
          >
            <Radio className="w-4 h-4 text-emerald-400" />
            <span>88+ Providers</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigateDocs('benchmarks');
              setMobileMenuOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800"
          >
            <Activity className="w-4 h-4 text-amber-400" />
            <span>Benchmarks & Latency</span>
          </button>
          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
            <a
              href="http://localhost:5173"
              target="_blank"
              rel="noreferrer"
              className="w-full text-center py-2 rounded-lg bg-sky-500 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Open Mission Control (5173)</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
