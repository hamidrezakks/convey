import { Activity, Globe, RotateCcw, Scale, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { Badge } from '../ui/Badge';

export function FeatureGrid() {
  const features = [
    {
      icon: ShieldCheck,
      color: 'emerald',
      title: 'Zero-Trust AES-256-GCM Envelope Encryption',
      tag: 'Security at Rest',
      description:
        'All recipient handles, message bodies, and template variables are encrypted with unique IVs before hitting PostgreSQL 18. In-memory decryption happens strictly in isolated worker threads.',
    },
    {
      icon: Zap,
      color: 'sky',
      title: '1-RTT DragonflyDB Idempotency Lease',
      tag: 'Sub-Millisecond Guard',
      description:
        'Atomic SET NX leases on multi-threaded DragonflyDB eliminate database row-level locking during traffic spikes. Duplicate submissions receive identical 202 Accepted responses in under 0.05ms.',
    },
    {
      icon: Scale,
      color: 'amber',
      title: 'Deficit Round Robin Multi-Tenant Scheduler',
      tag: 'Noisy Neighbor Elimination',
      description:
        'Quantum bandwidth arbitration (Enterprise = 200, Pro = 50, Free = 10) guarantees high-priority OTP delivery is never starved by bulk marketing campaigns (JFI >= 0.95).',
    },
    {
      icon: RotateCcw,
      color: 'rose',
      title: 'Blast-Radius Controlled DLQ & Mutated Replay',
      tag: 'Zero Data Loss',
      description:
        'Categorize failures by root-cause (Rate Limits, Auth Expired, Provider 5xx). Dry-run blast-radius impact and replay with mutated providers or throttled rate-limits.',
    },
    {
      icon: Activity,
      color: 'purple',
      title: 'Autonomous Synthetic Canaries & Stepped Half-Open Ramps',
      tag: 'Resilience',
      description:
        'Background synthetic probes evaluate degraded provider health. Once stable, probe traffic is admitted in stepped increments (5% ➔ 20% ➔ 50% ➔ 100%) to safely restore routes.',
    },
    {
      icon: Globe,
      color: 'cyan',
      title: 'Active-Active Cross-Region Multi-Cluster Heartbeats',
      tag: 'Geo-Replication',
      description:
        'Redis-backed distributed heartbeat mesh tracks regional availability. Automatic cross-datacenter failover ensures zero downtime during cloud provider regional outages.',
    },
  ];

  return (
    <section className="py-16 sm:py-20 bg-[#070b12]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <Badge variant="primary" size="md">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Staff-Level Distributed Systems Engineering</span>
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
            Engineered for Extreme Reliability & Scale
          </h2>
          <p className="text-xs sm:text-base text-slate-400">
            Convey solves distributed systems bottlenecks from first principles with zero external vendor dependencies.
          </p>
        </div>

        {/* 6-Grid Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="p-4 sm:p-6 rounded-2xl border border-slate-800 bg-[#090d16]/70 hover:bg-[#0e1626]/90 hover:border-slate-700 transition-all space-y-3 sm:space-y-4 shadow-lg group glass-panel-hover"
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <Badge variant="outline" size="sm" className="text-[10px] font-mono">
                    {f.tag}
                  </Badge>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <h3 className="text-sm sm:text-base font-bold text-slate-100 group-hover:text-sky-300 transition-colors">
                    {f.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{f.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
