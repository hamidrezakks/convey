'use client';

import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Server,
  Zap,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Badge } from '../ui/Badge';

interface StageInfo {
  id: number;
  name: string;
  shortName: string;
  icon: React.ElementType;
  color: string;
  badge: string;
  latency: string;
  description: string;
  codeSnippet: string;
  metrics: { label: string; value: string }[];
}

const stages: StageInfo[] = [
  {
    id: 1,
    name: '1. Client API Ingestion',
    shortName: 'Client Ingestion',
    icon: Server,
    color: 'sky',
    badge: 'Synchronous Fast-Path',
    latency: '0.4ms',
    description:
      'Client issues an HTTP POST with W3C traceparent header and Idempotency-Key. Elysia.js performs sub-millisecond TypeBox schema validation and DLP redaction for sensitive fields.',
    codeSnippet: `POST /v1/messages/send
Idempotency-Key: ord_99218_dispatch
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01

{
  "channel": "sms",
  "recipient": "+14155552671",
  "content": { "body": "Auth code: 849201" }
}`,
    metrics: [
      { label: 'Schema Validation', value: '< 0.05ms' },
      { label: 'DLP Redaction', value: '656k ops/s' },
    ],
  },
  {
    id: 2,
    name: '2. 1-RTT Redis Idempotency',
    shortName: 'Redis 1-RTT',
    icon: Zap,
    color: 'cyan',
    badge: 'Atomic SET NX',
    latency: '0.08ms',
    description:
      'IdempotencyService executes a single Redis SET key value EX 86400 NX call. Concurrent requests with the same key receive the cached 202 response without locking the SQL database.',
    codeSnippet: `// 1-RTT Fast Path (No prior GET round-trip)
const acquired = await redis.set(
  \`idemp:\${teamId}:\${idempotencyKey}\`,
  JSON.stringify({ status: 'ACCEPTED', publicId }),
  'EX', 86400,
  'NX'
);`,
    metrics: [
      { label: 'Redis Throughput', value: '13,741 ops/s' },
      { label: 'Race Contention', value: '1,000 threads safe' },
    ],
  },
  {
    id: 3,
    name: '3. PostgreSQL Monthly Partition',
    shortName: 'Postgres Partition',
    icon: Database,
    color: 'emerald',
    badge: 'ACID Transaction',
    latency: '2.1ms',
    description:
      'A single ACID transaction inserts the AES-256-GCM encrypted record into messages and enqueues a row in the outbox ledger. Range partitioning avoids table lock contention.',
    codeSnippet: `await db.transaction(async (tx) => {
  // 1. Insert immutable encrypted message
  await tx.insert(messages).values({ publicId, ...envelope });
  // 2. Insert transactional outbox record
  await tx.insert(outbox).values({ publicId, shardId, status: 'PENDING' });
});`,
    metrics: [
      { label: 'Transaction Time', value: '1.8ms - 3.2ms' },
      { label: 'Partition Type', value: 'Monthly Range' },
    ],
  },
  {
    id: 4,
    name: '4. SIMD Sharded Outbox Relay',
    shortName: 'SIMD Shard Relay',
    icon: Cpu,
    color: 'purple',
    badge: '5.2M ops/s',
    latency: '0.001ms',
    description:
      'Outbox Relay worker polls virtual shards using native SIMD Murmur32v3 hashing and FOR UPDATE SKIP LOCKED. Multiple worker pods process disjoint partitions without row locks.',
    codeSnippet: `// SIMD Murmur32v3 Fast Sharding
const shard = (Bun.hash.murmur32v3(publicId) >>> 0) % 16;

SELECT * FROM outbox 
WHERE shard_id = $1 AND status = 'PENDING'
ORDER BY created_at ASC LIMIT 100 
FOR UPDATE SKIP LOCKED;`,
    metrics: [
      { label: 'Shard Hashing', value: '5,258,082 ops/s' },
      { label: 'Lock Contention', value: '0% (SKIP LOCKED)' },
    ],
  },
  {
    id: 5,
    name: '5. BullMQ Multi-Tenant DRR',
    shortName: 'BullMQ DRR Queue',
    icon: Activity,
    color: 'amber',
    badge: 'JFI >= 0.95',
    latency: '1.2ms',
    description:
      'Messages enter Deficit Weighted Round Robin queues. Enterprise tenants (quantum = 200) receive guaranteed bandwidth without starvation from high-volume Free tier tenants.',
    codeSnippet: `// Deficit Round Robin Arbitration
while (deficit[tenantId] >= messageSize) {
  const job = queue.dequeue(tenantId);
  await dispatchWorker.process(job);
  deficit[tenantId] -= messageSize;
}`,
    metrics: [
      { label: 'Fairness Index', value: 'JFI = 0.982' },
      { label: 'Max Concurrency', value: 'Backlog-adaptive' },
    ],
  },
  {
    id: 6,
    name: '6. Provider Hedged Dispatch',
    shortName: 'Hedged Provider Wire',
    icon: Radio,
    color: 'rose',
    badge: 'Stepped Half-Open',
    latency: '120ms',
    description:
      'Payload is decrypted in-memory. Stepped half-open circuit breaker evaluates provider health (5% ➔ 20% ➔ 50% ➔ 100%). Speculative hedged requests drop p99 tail-latency.',
    codeSnippet: `// Dynamic Speculative Hedged Request
const result = await hedgedExecutor.execute({
  primary: () => twilio.send(payload),
  fallback: () => vonage.send(payload),
  hedgeDelayMs: 250 // Fire sibling if primary p95 exceeded
});`,
    metrics: [
      { label: 'Tail Latency Drop', value: '-65% p99' },
      { label: 'Circuit Breaker', value: 'Stepped Ramp' },
    ],
  },
];

export function ArchitectureVisualizer() {
  const [activeStage, setActiveStage] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveStage((prev) => (prev < 6 ? prev + 1 : 1));
    }, 4000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const current = stages.find((s) => s.id === activeStage) || stages[0];

  return (
    <section id="architecture" className="py-20 bg-[#080c14] border-t border-b border-slate-800/80 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <Badge variant="primary" size="md">
            <Cpu className="w-3.5 h-3.5" />
            <span>Interactive Dataflow Simulator</span>
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
            How Convey Guarantees Sub-15ms Ingestion & Zero Message Loss
          </h2>
          <p className="text-sm sm:text-base text-slate-400">
            Step through Convey’s 6-stage distributed pipeline from synchronous client ingestion to hedged provider wire
            delivery.
          </p>
        </div>

        {/* Pipeline Flow Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {stages.map((stage) => {
            const isActive = stage.id === activeStage;
            const isCompleted = stage.id < activeStage;
            const Icon = stage.icon;

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => {
                  setActiveStage(stage.id);
                  setIsPlaying(false);
                }}
                className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                  isActive
                    ? 'bg-sky-500/10 border-sky-500/50 shadow-[0_0_20px_rgba(56,189,248,0.2)]'
                    : isCompleted
                      ? 'bg-slate-900/60 border-slate-700/60 text-slate-300'
                      : 'bg-slate-950/40 border-slate-800/60 text-slate-500 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isActive
                        ? 'bg-sky-500 text-slate-950 font-bold'
                        : isCompleted
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{stage.latency}</span>
                </div>

                <div className="text-xs font-semibold text-slate-200 truncate w-full">{stage.shortName}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">{stage.badge}</div>

                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-cyan-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Active Stage Deep-Dive Card */}
        <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 shadow-2xl glass-panel">
          {/* Left Description & Metrics */}
          <div className="lg:col-span-6 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="primary" size="md">
                  Stage {current.id} of 6
                </Badge>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    Execution Time: <strong className="text-slate-200">{current.latency}</strong>
                  </span>
                </div>
              </div>

              <h3 className="text-2xl font-bold text-white font-display">{current.name}</h3>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">{current.description}</p>
            </div>

            {/* Metrics Chips */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              {current.metrics.map((m) => (
                <div key={m.label} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="text-[11px] text-slate-400 font-mono">{m.label}</div>
                  <div className="text-sm font-bold text-sky-400 font-mono">{m.value}</div>
                </div>
              ))}
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/80 transition-colors cursor-pointer"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-amber-400" />
                    <span>Pause Flow</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Auto Play</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveStage((prev) => (prev > 1 ? prev - 1 : 6));
                  setIsPlaying(false);
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors cursor-pointer"
                title="Previous stage"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveStage((prev) => (prev < 6 ? prev + 1 : 1));
                  setIsPlaying(false);
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors cursor-pointer"
                title="Next stage"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveStage(1);
                  setIsPlaying(true);
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/80 transition-colors ml-auto cursor-pointer"
                title="Reset to stage 1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Code / Execution Block */}
          <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-[#070b12] overflow-hidden flex flex-col shadow-inner">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
              <span className="text-slate-300 font-medium">Stage Implementation</span>
              <Badge variant="outline" size="sm" className="text-[10px]">
                Bun 1.4 Native
              </Badge>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed m-0 flex-1">
              <code>{current.codeSnippet}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
