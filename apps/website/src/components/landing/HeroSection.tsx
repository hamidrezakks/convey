'use client';

import { ArrowRight, Check, ChevronRight, Copy, Rocket, ShieldCheck, Sparkles, Terminal, Zap } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { copyToClipboard } from '../../lib/utils';
import { Button } from '../ui/Button';

export function HeroSection() {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [activeInstallTab, setActiveInstallTab] = useState<'docker' | 'bun' | 'curl'>('docker');

  const installCommands = {
    docker: 'docker compose up -d postgres redis',
    bun: 'bun install --frozen-lockfile',
    curl: 'curl http://localhost:3000/health',
  };

  const handleCopy = async (cmd: string) => {
    const success = await copyToClipboard(cmd);
    if (success) {
      setCopiedCmd(cmd);
      setTimeout(() => setCopiedCmd(null), 2000);
    }
  };

  return (
    <section className="relative overflow-hidden pt-8 pb-16 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28 glow-mesh bg-radial-gradient">
      {/* Background Subtle Grid Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 sm:space-y-8 z-10">
        {/* Top Tagline Badge */}
        <div className="inline-flex items-center gap-1.5 sm:gap-2 p-1 pl-2.5 pr-3 sm:pl-3 sm:pr-4 rounded-full border border-sky-500/30 bg-sky-500/10 backdrop-blur-md text-[11px] sm:text-xs font-medium text-sky-300 shadow-[0_0_20px_rgba(56,189,248,0.2)] max-w-full">
          <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="truncate">Convey pre-release — Bun, Elysia & Go gateway</span>
          <ChevronRight className="w-3 h-3 text-sky-400 shrink-0" />
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-7xl font-extrabold text-white tracking-tight font-display max-w-4xl mx-auto leading-[1.15] sm:leading-[1.1]">
          Self-Hosted{' '}
          <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
            Communication Infrastructure
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-lg lg:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed font-normal">
          A communication service for one regional deployment. Featuring{' '}
          <strong className="text-white font-semibold">durable HTTP 202 acceptance</strong>,{' '}
          <strong className="text-white font-semibold">AES-256-GCM payload encryption</strong>,{' '}
          <strong className="text-white font-semibold">optional WhatsApp session conversion</strong>, and{' '}
          <strong className="text-white font-semibold">a provider catalog with explicit readiness gates</strong>.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 w-full max-w-lg mx-auto sm:max-w-none">
          <Link href="/docs" className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="primary"
              className="w-full sm:w-auto"
              leftIcon={<Rocket className="w-4 h-4" />}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Explore Documentation
            </Button>
          </Link>
          <a href="#playground" className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="secondary"
              className="w-full sm:w-auto"
              leftIcon={<Terminal className="w-4 h-4 text-purple-400" />}
            >
              Illustrative API Playground
            </Button>
          </a>
          <a href="#architecture" className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
              leftIcon={<Zap className="w-4 h-4 text-cyan-400" />}
            >
              View System Architecture
            </Button>
          </a>
        </div>

        {/* 1-Line Quick Installation Bar */}
        <div className="max-w-xl mx-auto pt-2 sm:pt-4">
          <div className="rounded-2xl border border-slate-800 bg-[#090d16]/90 p-1.5 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-slate-800/80 mb-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                <span className="text-slate-500 font-mono text-[11px] ml-1 sm:ml-2">Quickstart</span>
              </div>
              <div className="flex items-center gap-1">
                {(['docker', 'bun', 'curl'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveInstallTab(tab)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      activeInstallTab === tab
                        ? 'bg-sky-500/20 text-sky-400 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between px-3 sm:px-4 py-2 font-mono text-xs text-slate-200 gap-2">
              <div className="flex items-center gap-2 overflow-x-auto touch-scroll py-0.5 min-w-0">
                <span className="text-sky-400 font-bold shrink-0">$</span>
                <span className="whitespace-nowrap text-[11px] sm:text-xs text-slate-300">
                  {installCommands[activeInstallTab]}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(installCommands[activeInstallTab])}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs font-medium cursor-pointer border border-slate-700/60 shrink-0 active:scale-95"
              >
                {copiedCmd === installCommands[activeInstallTab] ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Highlight Metric Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto pt-4 sm:pt-6 text-left">
          <div className="p-3.5 sm:p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm space-y-1">
            <div className="text-xl sm:text-2xl font-bold text-white font-mono flex items-center gap-1.5">
              <span className="text-sky-400">202</span>
              <span className="text-xs text-slate-400 font-normal">Accepted</span>
            </div>
            <div className="text-[11px] sm:text-xs text-slate-400 leading-tight">
              Accepted for Asynchronous Processing
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm space-y-1">
            <div className="text-xl sm:text-2xl font-bold text-white font-mono flex items-center gap-1.5">
              <span className="text-cyan-400">Catalog</span>
              <span className="text-xs text-slate-400 font-normal">Adapters</span>
            </div>
            <div className="text-[11px] sm:text-xs text-slate-400 leading-tight">Email, SMS, Push, WhatsApp</div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm space-y-1">
            <div className="text-xl sm:text-2xl font-bold text-white font-mono flex items-center gap-1.5">
              <span className="text-emerald-400">AES-256</span>
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            </div>
            <div className="text-[11px] sm:text-xs text-slate-400 leading-tight">Encrypted Payload Storage</div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm space-y-1">
            <div className="text-xl sm:text-2xl font-bold text-white font-mono flex items-center gap-1.5">
              <span className="text-purple-400">Go</span>
              <span className="text-xs text-slate-400 font-normal">Gateway</span>
            </div>
            <div className="text-[11px] sm:text-xs text-slate-400 leading-tight">
              Resolve Recipients from Your Customer Service
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
