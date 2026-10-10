'use client';

import { ExternalLink, Zap } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '../ui/Badge';

export function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-[#05080f] text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Col 1: Brand & Tagline */}
          <div className="sm:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center">
                <Zap className="w-4 h-4 text-sky-400 fill-sky-400" />
              </div>
              <span className="text-base font-extrabold text-white tracking-tight font-display">CONVEY</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
              Self-hosted, pre-release communication service with an optional Go recipient gateway. Built with Bun,
              Elysia.js, PostgreSQL range-partitioning, and BullMQ.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="success" size="sm" className="text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Pre-release Candidate
              </Badge>
              <Badge variant="outline" size="sm" className="text-[10px] font-mono">
                Mock Qualification
              </Badge>
            </div>
          </div>

          {/* Col 2: Documentation */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider font-mono">Documentation</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/docs/quickstart" className="hover:text-sky-400 transition-colors block py-0.5">
                  Quickstart Runbook
                </Link>
              </li>
              <li>
                <Link href="/docs/architecture" className="hover:text-sky-400 transition-colors block py-0.5">
                  System Architecture
                </Link>
              </li>
              <li>
                <Link href="/docs/gateway" className="hover:text-sky-400 transition-colors block py-0.5">
                  Go Recipient Gateway
                </Link>
              </li>
              <li>
                <Link href="/docs/configuration" className="hover:text-sky-400 transition-colors block py-0.5">
                  Configuration (.env)
                </Link>
              </li>
              <li>
                <Link href="/docs/api-reference" className="hover:text-sky-400 transition-colors block py-0.5">
                  REST API Specification
                </Link>
              </li>
              <li>
                <Link href="/docs/providers" className="hover:text-sky-400 transition-colors block py-0.5">
                  Provider Catalog & Readiness
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Technical Deep-Dives */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider font-mono">Engineering</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/docs/examples" className="hover:text-sky-400 transition-colors block py-0.5">
                  Architectural Recipes
                </Link>
              </li>
              <li>
                <Link href="/docs/webhooks" className="hover:text-sky-400 transition-colors block py-0.5">
                  Inbound Webhooks & DLR
                </Link>
              </li>
              <li>
                <Link href="/docs/benchmarks" className="hover:text-sky-400 transition-colors block py-0.5">
                  Benchmark Evidence & Limits
                </Link>
              </li>
              <li>
                <Link href="/docs/deployment" className="hover:text-sky-400 transition-colors block py-0.5">
                  Deployment & Operations
                </Link>
              </li>
              <li>
                <Link href="/docs/sdks" className="hover:text-sky-400 transition-colors block py-0.5">
                  TypeScript, Python & Go
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Ecosystem & Tools */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider font-mono">Ecosystem</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="http://localhost:5173"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-sky-400 transition-colors inline-flex items-center gap-1 py-0.5"
                >
                  <span>Mission Control App</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a
                  href="http://localhost:3000/swagger"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-sky-400 transition-colors inline-flex items-center gap-1 py-0.5"
                >
                  <span>Swagger / OpenAPI UI</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a
                  href="http://localhost:3000/metrics"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-sky-400 transition-colors inline-flex items-center gap-1 py-0.5"
                >
                  <span>Prometheus Metrics (local)</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hamidrezakks/convey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-sky-400 transition-colors inline-flex items-center gap-1 py-0.5"
                >
                  <span>GitHub Repository</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400 text-center sm:text-left">
          <div>
            &copy; {new Date().getFullYear()} Convey Engineering. High-Performance Communication Infrastructure.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <span>Powered by Bun 1.4 & Elysia</span>
            <span>PostgreSQL & Redis-Compatible Queues</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
