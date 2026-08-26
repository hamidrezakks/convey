import { Activity, BarChart3, Cpu, Zap } from 'lucide-react';
import { Badge } from '../ui/Badge';

export function BenchmarkSection() {
  return (
    <section id="benchmarks" className="py-16 sm:py-20 bg-[#080c14] border-t border-b border-slate-800/80 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <Badge variant="primary" size="md">
            <Activity className="w-3.5 h-3.5" />
            <span>High-Throughput Verification</span>
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
            Verified Sub-Millisecond Benchmarks
          </h2>
          <p className="text-xs sm:text-base text-slate-400">
            Measured with HDR nanosecond-precision histograms on Bun 1.4. Zero mock overhead, verified across
            single-core micro-engines and high-concurrency ingestion.
          </p>
        </div>

        {/* Highlight 3-Card Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="p-4 sm:p-6 rounded-2xl border border-slate-800 bg-[#0a0f1c] space-y-3 glass-panel">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">5,258,082</div>
              <div className="text-xs font-semibold text-slate-300">SIMD Shard Routing (ops/sec)</div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Murmur32v3 hash computed in &lt; 1 µs using native C++ SIMD instructions on Bun 1.4 without buffer
              allocations.
            </p>
            <div className="text-[11px] font-mono text-sky-400 pt-2 border-t border-slate-800/80">
              Latency p99: 0.001ms
            </div>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl border border-slate-800 bg-[#0a0f1c] space-y-3 glass-panel">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Cpu className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">5,069,708</div>
              <div className="text-xs font-semibold text-slate-300">W3C Distributed Tracing (ops/sec)</div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Zero-allocation traceparent parsing and span header injection for high-throughput distributed tracing.
            </p>
            <div className="text-[11px] font-mono text-cyan-400 pt-2 border-t border-slate-800/80">
              Latency p99: 0.001ms
            </div>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl border border-slate-800 bg-[#0a0f1c] space-y-3 glass-panel">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">10,233</div>
              <div className="text-xs font-semibold text-slate-300">Webhook Ingestion (events/sec)</div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Inbound delivery receipt and WhatsApp status handshake ingestion through Elysia.js with micro-batch
              commit.
            </p>
            <div className="text-[11px] font-mono text-emerald-400 pt-2 border-t border-slate-800/80">
              Latency p95: 0.209ms
            </div>
          </div>
        </div>

        {/* Detailed Micro-Engine Benchmark Table */}
        <div className="rounded-2xl border border-slate-800 bg-[#090d16] overflow-hidden shadow-2xl">
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono truncate">
                Micro-Engine Performance SLA Table
              </span>
            </div>
            <Badge variant="outline" size="sm" className="text-[10px] shrink-0">
              HDR Percentiles
            </Badge>
          </div>

          <div className="overflow-x-auto touch-scroll">
            <table className="w-full text-left text-xs border-collapse font-mono min-w-[620px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-semibold">Subsystem Operation</th>
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-semibold">Category</th>
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-semibold">Throughput</th>
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-semibold">p50</th>
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-semibold">p95</th>
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-semibold">p99</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {[
                  {
                    op: 'ConsistentHashShardRouter',
                    cat: 'SIMD Murmur32v3',
                    ops: '5,258,082/s',
                    p50: '< 0.001ms',
                    p95: '< 0.001ms',
                    p99: '< 0.001ms',
                  },
                  {
                    op: 'TraceContext.extractOrCreate',
                    cat: 'W3C Tracing',
                    ops: '5,069,708/s',
                    p50: '< 0.001ms',
                    p95: '< 0.001ms',
                    p99: '0.001ms',
                  },
                  {
                    op: 'GradualRampController',
                    cat: 'Stepped Probe Admission',
                    ops: '4,544,586/s',
                    p50: '< 0.001ms',
                    p95: '< 0.001ms',
                    p99: '0.001ms',
                  },
                  {
                    op: 'BoundedLruCache.get & set',
                    cat: 'L1 In-Memory Cache',
                    ops: '3,080,555/s',
                    p50: '< 0.001ms',
                    p95: '< 0.001ms',
                    p99: '0.001ms',
                  },
                  {
                    op: 'WhatsAppTemplateEngine',
                    cat: 'AST Pre-Compilation',
                    ops: '1,730,228/s',
                    p50: '< 0.001ms',
                    p95: '0.001ms',
                    p99: '0.002ms',
                  },
                  {
                    op: 'ByteBufferPool.acquire',
                    cat: 'Pre-Allocated Arena',
                    ops: '1,285,195/s',
                    p50: '0.001ms',
                    p95: '0.001ms',
                    p99: '0.001ms',
                  },
                  {
                    op: 'DlpScanner.sanitize',
                    cat: 'PII Regex Redaction',
                    ops: '656,886/s',
                    p50: '0.001ms',
                    p95: '0.003ms',
                    p99: '0.004ms',
                  },
                  {
                    op: 'HedgedExecutor.execute',
                    cat: 'Speculative Parallel Race',
                    ops: '625,717/s',
                    p50: '0.001ms',
                    p95: '0.003ms',
                    p99: '0.008ms',
                  },
                  {
                    op: 'DRR Priority Scheduler',
                    cat: 'Deficit Round Robin',
                    ops: '519,244/s',
                    p50: '0.002ms',
                    p95: '0.004ms',
                    p99: '0.008ms',
                  },
                  {
                    op: 'PayloadEncryptionManager',
                    cat: 'AES-256-GCM Envelope',
                    ops: '281,162/s',
                    p50: '0.003ms',
                    p95: '0.007ms',
                    p99: '0.015ms',
                  },
                  {
                    op: 'IdempotencyService.reserve',
                    cat: 'DragonflyDB SET NX 1-RTT',
                    ops: '13,741/s',
                    p50: '0.062ms',
                    p95: '0.082ms',
                    p99: '0.148ms',
                  },
                ].map((row) => (
                  <tr key={row.op} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 sm:px-4 font-semibold text-slate-100">{row.op}</td>
                    <td className="py-2.5 px-3 sm:px-4 text-slate-400 font-sans text-[11px]">{row.cat}</td>
                    <td className="py-2.5 px-3 sm:px-4 text-sky-400 font-bold">{row.ops}</td>
                    <td className="py-2.5 px-3 sm:px-4 text-slate-300">{row.p50}</td>
                    <td className="py-2.5 px-3 sm:px-4 text-slate-300">{row.p95}</td>
                    <td className="py-2.5 px-3 sm:px-4 text-emerald-400 font-bold">{row.p99}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
