import { ExternalLink, Zap } from 'lucide-react';
import { Badge } from '../ui/Badge';

export interface FooterProps {
  onNavigateDocs: (docId: string) => void;
}

export function Footer({ onNavigateDocs }: FooterProps) {
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
                <button
                  type="button"
                  onClick={() => onNavigateDocs('quickstart')}
                  className="hover:text-sky-400 transition-colors cursor-pointer"
                >
                  Quickstart (2 min)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateDocs('architecture')}
                  className="hover:text-sky-400 transition-colors cursor-pointer"
                >
                  Transactional Outbox
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateDocs('configuration')}
                  className="hover:text-sky-400 transition-colors cursor-pointer"
                >
                  Environment Config (.env)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateDocs('api-reference')}
                  className="hover:text-sky-400 transition-colors cursor-pointer"
                >
                  REST API Specification
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Providers & Ecosystem */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider font-mono">Ecosystem</h4>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateDocs('providers')}
                  className="hover:text-sky-400 transition-colors cursor-pointer"
                >
                  88+ Turnkey Adapters
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateDocs('sdks')}
                  className="hover:text-sky-400 transition-colors cursor-pointer"
                >
                  TypeScript & Python SDKs
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateDocs('deployment')}
                  className="hover:text-sky-400 transition-colors cursor-pointer"
                >
                  Docker & Kubernetes
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateDocs('benchmarks')}
                  className="hover:text-sky-400 transition-colors cursor-pointer"
                >
                  HDR Latency Benchmarks
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Interactive Tools */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider font-mono">Live Tools</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="http://localhost:5173"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-sky-400 transition-colors flex items-center gap-1"
                >
                  <span>Mission Control Web UI</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a
                  href="http://localhost:3000/swagger"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-sky-400 transition-colors flex items-center gap-1"
                >
                  <span>OpenAPI Swagger UI</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/convey/convey"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-sky-400 transition-colors flex items-center gap-1"
                >
                  <span>GitHub Repository</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-xs">
          <div>
            © {new Date().getFullYear()} Convey Communication Infrastructure. 100% Standalone Open Architecture.
          </div>
          <div className="flex items-center gap-4">
            <span>Engineered for sub-15ms high-concurrency workloads.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
