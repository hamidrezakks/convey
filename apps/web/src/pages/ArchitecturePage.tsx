import { Activity, Cpu, Database, Network, Terminal } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export function ArchitecturePage() {
  const promMetrics = `# HELP convey_messages_ingested_total Total messages ingested by channel and priority
# TYPE convey_messages_ingested_total counter
convey_messages_ingested_total{channel="email",priority="default",tenant="team_auth"} 8421
convey_messages_ingested_total{channel="sms",priority="critical",tenant="team_payments"} 3140
convey_messages_ingested_total{channel="whatsapp",priority="default",tenant="team_marketing"} 1980

# HELP convey_delivery_duration_seconds Latency histogram from ingest to wire delivery
# TYPE convey_delivery_duration_seconds histogram
convey_delivery_duration_seconds_bucket{le="0.005"} 4120
convey_delivery_duration_seconds_bucket{le="0.010"} 8910
convey_delivery_duration_seconds_bucket{le="0.025"} 12410
convey_delivery_duration_seconds_bucket{le="0.050"} 13120
convey_delivery_duration_seconds_bucket{le="+Inf"} 13420
convey_delivery_duration_seconds_sum 148.92
convey_delivery_duration_seconds_count 13420

# HELP convey_circuit_breaker_state Current state of provider circuit breaker (0=closed, 1=half_open, 2=open)
# TYPE convey_circuit_breaker_state gauge
convey_circuit_breaker_state{provider="aws-ses",channel="email"} 0
convey_circuit_breaker_state{provider="twilio-sms",channel="sms"} 0
convey_circuit_breaker_state{provider="meta-whatsapp",channel="whatsapp"} 0`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Cpu className="w-5 h-5 text-sky-400" />
            System Topology & Prometheus Telemetry
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Planetary multi-region cluster architecture, monthly partition pruning, and OpenMetrics scrape endpoints.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open('/metrics', '_blank')}
          className="text-xs gap-1.5 font-mono"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>GET /metrics</span>
        </Button>
      </div>

      {/* Architecture Topology Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tier 1: Ingestion & Fast-Path */}
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-sky-400" />
              <CardTitle className="text-sm font-semibold text-white">Tier 1: 1-RTT Ingestion</CardTitle>
            </div>
            <CardDescription>Ultra-low latency HTTP acceptance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs text-slate-300">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="font-semibold text-sky-300">Bun + Elysia Edge API:</span>
              <p className="text-slate-400 mt-0.5">
                Static route tree compilation with native CORS and zero GC overhead.
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="font-semibold text-indigo-300">Redis SET NX Idempotency:</span>
              <p className="text-slate-400 mt-0.5">
                Scoped by team boundary. Returns 202 Accepted on identical replay.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tier 2: Storage & Outbox */}
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <CardTitle className="text-sm font-semibold text-white">Tier 2: Range Partitioning</CardTitle>
            </div>
            <CardDescription>Transactional durability & outbox pattern.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs text-slate-300">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="font-semibold text-emerald-300">PostgreSQL Range Partitions:</span>
              <p className="text-slate-400 mt-0.5">
                Monthly boundaries (`messages_y2026m08`) with instant partition drop.
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="font-semibold text-emerald-300">Atomic Outbox Commit:</span>
              <p className="text-slate-400 mt-0.5">Single transaction inserts message and pending outbox event.</p>
            </div>
          </CardContent>
        </Card>

        {/* Tier 3: Async Relays & Workers */}
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-400" />
              <CardTitle className="text-sm font-semibold text-white">Tier 3: BullMQ Pipeline</CardTitle>
            </div>
            <CardDescription>Multi-tenant DRR & provider sending.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs text-slate-300">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="font-semibold text-violet-300">DRR SLA Scheduler:</span>
              <p className="text-slate-400 mt-0.5">Quantum weights prevent noisy-neighbor starvation.</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="font-semibold text-violet-300">Self-Healing Provider Engine:</span>
              <p className="text-slate-400 mt-0.5">
                EMA latency tracker, automatic failover, and synthetic canary probes.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Prometheus Scrape Inspector */}
      <Card className="glass-panel">
        <CardHeader className="py-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Live Prometheus Metrics Scrape Endpoint (/metrics)
            </CardTitle>
            <CardDescription>
              Compatible with Grafana, Datadog, CloudWatch, and Google Cloud Monitoring.
            </CardDescription>
          </div>
          <Badge variant="cyan">OpenMetrics Format</Badge>
        </CardHeader>
        <CardContent>
          <pre className="p-4 bg-slate-950 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto border border-slate-800 leading-relaxed">
            {promMetrics}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
