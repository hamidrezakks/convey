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
    name: '1. Authenticated Message Ingestion',
    shortName: 'API Ingestion',
    icon: Server,
    color: 'sky',
    badge: 'Request Validation',
    latency: 'Varies',
    description:
      'The API verifies stored credential scope and validates the full message request. This schematic omits implementation detail; stage timings are not measurements.',
    codeSnippet: `POST /v1/messages
Authorization: Bearer <CONVEY_API_KEY>
Content-Type: application/json

{
  "idempotencyKey": "order-482",
  "userId": "customer-482",
  "team": "orders",
  "category": "TRANSACTIONAL",
  "country": "US",
  "priority": "normal",
  "recipients": {
    "phone": "+12025550123"
  },
  "channels": [
    {
      "channel": "sms",
      "content": {
        "text": "Order confirmed."
      }
    }
  ]
}`,
    metrics: [
      {
        label: 'Scope',
        value: 'Stored identity',
      },
      {
        label: 'Contract',
        value: 'Full wire payload',
      },
    ],
  },
  {
    id: 2,
    name: '2. Scoped Idempotency Reservation',
    shortName: 'Idempotency',
    icon: Zap,
    color: 'cyan',
    badge: '24h Default Retention',
    latency: 'Varies',
    description:
      'An atomic Redis-compatible SET NX reserves a team and sandbox-scoped key with a payload hash. Completed matching requests replay the saved response; in-progress or conflicting requests return 409.',
    codeSnippet: `// Schematic: scope and hash are computed by the service.
SET <team + sandbox + key> <processing record> EX 86400 NX

// After durable acceptance, save the original response.
// Key-store loss or TTL expiration changes replay guarantees.`,
    metrics: [
      {
        label: 'Identical completed request',
        value: 'Saved response',
      },
      {
        label: 'Different / pending request',
        value: '409 conflict',
      },
    ],
  },
  {
    id: 3,
    name: '3. PostgreSQL Message & Outbox Transaction',
    shortName: 'PostgreSQL Commit',
    icon: Database,
    color: 'emerald',
    badge: 'Durable Acceptance',
    latency: 'Varies',
    description:
      'Message acceptance commits the encrypted payload and outbox row in one PostgreSQL transaction. HTTP 202 identifies accepted work; it does not certify provider acceptance or recipient delivery.',
    codeSnippet: `// Schematic transaction, not a complete SQL statement.
BEGIN;
  INSERT INTO messages (...);
  INSERT INTO outbox (...);
COMMIT;

// Return { messageId: "msg_<ULID>", state, createdAt }`,
    metrics: [
      {
        label: 'Storage',
        value: 'Messages + outbox',
      },
      {
        label: 'Response',
        value: '202 accepted',
      },
    ],
  },
  {
    id: 4,
    name: '4. Sharded Outbox Relay',
    shortName: 'Outbox Relay',
    icon: Cpu,
    color: 'purple',
    badge: 'SKIP LOCKED',
    latency: 'Varies',
    description:
      'The relay claims ready rows by virtual shard, publishes deterministic jobs, and marks rows processed after enqueueing. Expired claims can be retried; locking and recovery still depend on the stores.',
    codeSnippet: `// Shard key uses tenant and message identifiers.
const shard = (Bun.hash.murmur32v3(\`\${tenantId}:\${messageId}\`) >>> 0) % 16;

// Simplified selection; recovery also considers expired claims.
SELECT * FROM outbox
WHERE shard_id = $1 AND state = 'pending'
  AND available_at <= now()
ORDER BY available_at ASC
LIMIT 250 FOR UPDATE SKIP LOCKED;`,
    metrics: [
      {
        label: 'Virtual shards',
        value: '16 by default',
      },
      {
        label: 'Row claims',
        value: 'Bounded batches',
      },
    ],
  },
  {
    id: 5,
    name: '5. Asynchronous Queue Processing',
    shortName: 'Queue Processing',
    icon: Activity,
    color: 'amber',
    badge: 'BullMQ Workers',
    latency: 'Varies',
    description:
      'Workers process accepted jobs with priority, scheduling, policy checks, and bounded retries. Near-term work uses BullMQ; longer schedules remain in PostgreSQL until promotion.',
    codeSnippet: `// Schematic scheduling boundary
execution within 30 minutes -> BullMQ
execution beyond 30 minutes -> PostgreSQL schedule

// Scheduling accepts future work.
// It is not an exact delivery-time promise.`,
    metrics: [
      {
        label: 'Delivery timing',
        value: 'Deployment dependent',
      },
      {
        label: 'Retry behavior',
        value: 'Bounded',
      },
    ],
  },
  {
    id: 6,
    name: '6. Provider Dispatch & Subsequent Outcomes',
    shortName: 'Provider Dispatch',
    icon: Radio,
    color: 'rose',
    badge: 'Adapter Readiness',
    latency: 'Varies',
    description:
      'A configured, available adapter sends to the provider. Signed receipts and status queries record subsequent outcomes where supported. Timeouts can leave acceptance uncertain, and retries may duplicate delivery.',
    codeSnippet: `// Schematic lifecycle
accepted -> queued -> sending

provider response / receipt -> subsequent outcome

// Adapter presence is not live certification.
// Query status or verify signed customer events.`,
    metrics: [
      {
        label: 'Provider availability',
        value: 'Readiness gated',
      },
      {
        label: 'Delivery evidence',
        value: 'Provider specific',
      },
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
    <section
      id="architecture"
      className="py-16 sm:py-20 bg-[#080c14] border-t border-b border-slate-800/80 scroll-mt-16"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <Badge variant="primary" size="md">
            <Cpu className="w-3.5 h-3.5" />
            <span>Interactive Dataflow Simulator</span>
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
            From Durable Acceptance to Provider Outcomes
          </h2>
          <p className="text-xs sm:text-base text-slate-400">
            Step through a schematic of the service pipeline. This animation does not execute work or measure timing;
            qualification currently covers one regional deployment with mock providers.
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
                className={`flex flex-col items-start p-3 sm:p-3.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden min-h-[90px] justify-between ${
                  isActive
                    ? 'bg-sky-500/10 border-sky-500/50 shadow-[0_0_20px_rgba(56,189,248,0.2)]'
                    : isCompleted
                      ? 'bg-slate-900/60 border-slate-700/60 text-slate-300'
                      : 'bg-slate-950/40 border-slate-800/60 text-slate-500 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1 sm:mb-2">
                  <div
                    className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center ${
                      isActive
                        ? 'bg-sky-500 text-slate-950 font-bold'
                        : isCompleted
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    ) : (
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 font-medium">{stage.latency}</span>
                </div>

                <div className="w-full">
                  <div className="text-xs font-semibold text-slate-200 truncate w-full">{stage.shortName}</div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">{stage.badge}</div>
                </div>

                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-cyan-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Active Stage Deep-Dive Card */}
        <div className="rounded-2xl border border-slate-800 bg-[#0a0f1c] p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 shadow-2xl glass-panel">
          {/* Left Description & Metrics */}
          <div className="lg:col-span-6 space-y-4 sm:space-y-6 flex flex-col justify-between">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Badge variant="primary" size="sm">
                  Stage {current.id} of 6
                </Badge>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    Stage Timing: <strong className="text-slate-200">{current.latency}</strong>
                  </span>
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-white font-display leading-snug">{current.name}</h3>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{current.description}</p>
            </div>

            {/* Metrics Chips */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-1 sm:pt-2">
              {current.metrics.map((m) => (
                <div
                  key={m.label}
                  className="p-2.5 sm:p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1"
                >
                  <div className="text-[10px] sm:text-[11px] text-slate-400 font-mono">{m.label}</div>
                  <div className="text-xs sm:text-sm font-bold text-sky-400 font-mono">{m.value}</div>
                </div>
              ))}
            </div>

            {/* Playback Controls */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/80 transition-colors cursor-pointer min-h-[38px]"
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

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveStage((prev) => (prev > 1 ? prev - 1 : 6));
                    setIsPlaying(false);
                  }}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center"
                  title="Previous stage"
                  aria-label="Previous stage"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveStage((prev) => (prev < 6 ? prev + 1 : 1));
                    setIsPlaying(false);
                  }}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center"
                  title="Next stage"
                  aria-label="Next stage"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveStage(1);
                  setIsPlaying(true);
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/80 transition-colors ml-auto cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center"
                title="Reset to stage 1"
                aria-label="Reset to stage 1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Code / Execution Block */}
          <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-[#070b12] overflow-hidden flex flex-col shadow-inner">
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
              <span className="text-slate-300 font-medium text-xs">Schematic Implementation</span>
              <Badge variant="outline" size="sm" className="text-[10px]">
                Illustrative Flow
              </Badge>
            </div>
            <pre className="p-3 sm:p-4 text-[11px] sm:text-xs font-mono text-slate-200 overflow-x-auto touch-scroll leading-relaxed m-0 flex-1">
              <code>{current.codeSnippet}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
