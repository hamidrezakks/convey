'use client';

import { ExternalLink, Zap } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '../ui/Badge';

export function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-[#05080f] text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 lg:gap-12">
          {/* Col 1: Brand & Tagline */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center">
                <Zap className="w-4 h-4 text-sky-400 fill-sky-400" />
              </div>
              <span className="text-base font-extrabold text-white tracking-tight font-display">CONVEY</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
              Planetary-scale, high-throughput communication infrastructure & notification engine. Built with Bun 1.4,
              Elysia.js, PostgreSQL range-partitioning, and BullMQ.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <Badge variant="success" size="sm" className="text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Cluster Operational
              </Badge>
              <Badge variant="outline" size="sm" className="text-[10px] font-mono">
                v1.0.0 Enterprise
              </Badge>
            </div>
          </div>

          {/* Col 2: Documentation */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider font-mono">Documentation</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/docs/quickstart" className="hover:text-sky-400 transition-colors">
                  Quickstart Runbook
                </Link>
              </li>
              <li>
                <Link href="/docs/architecture" className="hover:text-sky-400 transition-colors">
                  System Architecture
                </Link>
              </li>
              <li>
                <Link href="/docs/configuration" className="hover:text-sky-400 transition-colors">
                  Configuration (.env)
                </Link>
              </li>
              <li>
                <Link href="/docs/api-reference" className="hover:text-sky-400 transition-colors">
                  REST API Specification
                </Link>
              </li>
              <li>
                <Link href="/docs/providers" className="hover:text-sky-400 transition-colors">
                  88+ Turnkey Adapters
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Technical Deep-Dives */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider font-mono">Engineering</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/docs/benchmarks" className="hover:text-sky-400 transition-colors">
                  HDR Percentiles & SLA
                </Link>
              </li>
              <li>
                <Link href="/docs/deployment" className="hover:text-sky-400 transition-colors">
                  Docker & Kubernetes HPA
                </Link>
              </li>
              <li>
                <Link href="/docs/sdks" className="hover:text-sky-400 transition-colors">
                  TypeScript, Python & Go
                </Link>
              </li>
              <li>
                <a href="#playground" className="hover:text-sky-400 transition-colors">
                  Interactive API Playground
                </a>
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
                  className="hover:text-sky-400 transition-colors inline-flex items-center gap-1"
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
                  className="hover:text-sky-400 transition-colors inline-flex items-center gap-1"
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
                  className="hover:text-sky-400 transition-colors inline-flex items-center gap-1"
                >
                  <span>Prometheus Metrics</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/convey/convey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-sky-400 transition-colors inline-flex items-center gap-1"
                >
                  <span>GitHub Repository</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
          <div>
            &copy; {new Date().getFullYear()} Convey Engineering. High-Performance Communication Infrastructure.
          </div>
          <div className="flex items-center gap-6">
            <span>Powered by Bun 1.4 & Elysia</span>
            <span>Zero External Vendor Dependencies</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
