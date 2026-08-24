import { ArrowRight, Check, ChevronRight, Copy, Rocket, ShieldCheck, Sparkles, Terminal, Zap } from 'lucide-react';
import { useState } from 'react';
import { copyToClipboard } from '../../lib/utils';
import { Button } from '../ui/Button';

export interface HeroSectionProps {
  onExploreDocs: () => void;
  onOpenPlayground: () => void;
  onOpenArchitecture: () => void;
}

export function HeroSection({ onExploreDocs, onOpenPlayground, onOpenArchitecture }: HeroSectionProps) {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [activeInstallTab, setActiveInstallTab] = useState<'docker' | 'bun' | 'curl'>('docker');

  const installCommands = {
    docker: 'docker compose up -d',
    bun: 'bun add @convey/client',
    curl: 'curl -X POST http://localhost:3000/v1/messages/send -H "Authorization: Bearer cv_live_..."',
  };

  const handleCopy = async (cmd: string) => {
    const success = await copyToClipboard(cmd);
    if (success) {
      setCopiedCmd(cmd);
      setTimeout(() => setCopiedCmd(null), 2000);
    }
  };

  return (
    <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 glow-mesh bg-radial-gradient">
      {/* Background Subtle Grid Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8 z-10">
        {/* Top Tagline Badge */}
        <div className="inline-flex items-center gap-2 p-1 pl-3 pr-4 rounded-full border border-sky-500/30 bg-sky-500/10 backdrop-blur-md text-xs font-medium text-sky-300 shadow-[0_0_20px_rgba(56,189,248,0.2)] animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>Convey v1.0 Enterprise Engine — Built on Bun 1.4 & Elysia.js</span>
          <ChevronRight className="w-3 h-3 text-sky-400" />
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight font-display max-w-4xl mx-auto leading-[1.1]">
          Planetary-Scale, Fault-Tolerant{' '}
          <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
            Communication Infrastructure
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed font-normal">
          Engineered for mission-critical enterprise workloads. Featuring{' '}
          <strong className="text-white font-semibold">sub-15ms synchronous send acceptance</strong>,{' '}
          <strong className="text-white font-semibold">zero-trust envelope encryption at rest</strong>,{' '}
          <strong className="text-white font-semibold">autonomous WhatsApp 24h session cost optimization</strong>, and{' '}
          <strong className="text-white font-semibold">88 turnkey provider integrations</strong>.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Button
            size="lg"
            variant="primary"
            leftIcon={<Rocket className="w-4 h-4" />}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={onExploreDocs}
          >
            Explore Documentation
          </Button>
          <Button
            size="lg"
            variant="secondary"
            leftIcon={<Terminal className="w-4 h-4 text-purple-400" />}
            onClick={onOpenPlayground}
          >
            Interactive API Playground
          </Button>
          <Button
            size="lg"
            variant="outline"
            leftIcon={<Zap className="w-4 h-4 text-cyan-400" />}
            onClick={onOpenArchitecture}
          >
            View System Architecture
          </Button>
        </div>

        {/* 1-Line Quick Installation Bar */}
        <div className="max-w-xl mx-auto pt-4">
          <div className="rounded-2xl border border-slate-800 bg-[#090d16]/90 p-1.5 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center justify-between px-3 py-1 text-xs border-b border-slate-800/80 mb-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                <span className="text-slate-500 font-mono text-[11px] ml-2">Quickstart</span>
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

            <div className="flex items-center justify-between px-4 py-2.5 font-mono text-xs text-slate-200 gap-3">
              <div className="flex items-center gap-2 truncate">
                <span className="text-sky-400 font-bold">$</span>
                <span className="truncate">{installCommands[activeInstallTab]}</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(installCommands[activeInstallTab])}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs font-medium cursor-pointer border border-slate-700/60 shrink-0 active:scale-95"
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-6 text-left">
          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm space-y-1">
            <div className="text-2xl font-bold text-white font-mono flex items-center gap-1.5">
              <span className="text-sky-400">&lt; 15ms</span>
              <span className="text-xs text-slate-400 font-normal">p99</span>
            </div>
            <div className="text-xs text-slate-400">Synchronous Hot-Path Send</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm space-y-1">
            <div className="text-2xl font-bold text-white font-mono flex items-center gap-1.5">
              <span className="text-cyan-400">88+</span>
              <span className="text-xs text-slate-400 font-normal">Adapters</span>
            </div>
            <div className="text-xs text-slate-400">Email, SMS, Push, Chat, WhatsApp</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm space-y-1">
            <div className="text-2xl font-bold text-white font-mono flex items-center gap-1.5">
              <span className="text-emerald-400">AES-256</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xs text-slate-400">Zero-Trust Envelope Encryption</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm space-y-1">
            <div className="text-2xl font-bold text-white font-mono flex items-center gap-1.5">
              <span className="text-purple-400">5.2M</span>
              <span className="text-xs text-slate-400 font-normal">ops/s</span>
            </div>
            <div className="text-xs text-slate-400">SIMD Murmur32v3 Shard Router</div>
          </div>
        </div>
      </div>
    </section>
  );
}
