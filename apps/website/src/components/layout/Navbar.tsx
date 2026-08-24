'use client';

import { Activity, ArrowUpRight, BookOpen, Cpu, Radio, Sliders, Terminal, Zap } from 'lucide-react';
import Link from 'next/link';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-[#070b12]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 p-0.5 shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#070b12] rounded-[10px] flex items-center justify-center">
              <Zap className="w-4 h-4 text-sky-400 fill-sky-400" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-base tracking-tight text-white flex items-center gap-1.5">
              CONVEY
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                v1.0
              </span>
            </span>
          </div>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
          <Link
            href="/docs"
            className="flex items-center gap-1.5 hover:text-sky-400 transition-colors text-white font-semibold"
          >
            <BookOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>Documentation</span>
          </Link>
          <a href="#architecture" className="flex items-center gap-1.5 hover:text-sky-400 transition-colors">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span>Architecture</span>
          </a>
          <a href="#playground" className="flex items-center gap-1.5 hover:text-sky-400 transition-colors">
            <Terminal className="w-3.5 h-3.5 text-slate-400" />
            <span>Playground</span>
          </a>
          <a href="#recipes" className="flex items-center gap-1.5 hover:text-sky-400 transition-colors">
            <Zap className="w-3.5 h-3.5 text-slate-400" />
            <span>Recipes</span>
          </a>
          <a href="#providers" className="flex items-center gap-1.5 hover:text-sky-400 transition-colors">
            <Radio className="w-3.5 h-3.5 text-slate-400" />
            <span>Providers</span>
          </a>
          <a href="#benchmarks" className="flex items-center gap-1.5 hover:text-sky-400 transition-colors">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span>Benchmarks</span>
          </a>
        </nav>

        {/* Right CTA Actions */}
        <div className="flex items-center gap-3">
          <a
            href="http://localhost:5173"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Mission Control</span>
            <ArrowUpRight className="w-3 h-3 text-slate-500" />
          </a>

          <a
            href="https://github.com/convey/convey"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub Repository"
            className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="GitHub Repository"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span className="sr-only">GitHub</span>
          </a>

          <Link
            href="/docs/quickstart"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs shadow-lg shadow-sky-500/20 transition-all hover:scale-105 active:scale-95"
          >
            <span>Get Started</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
