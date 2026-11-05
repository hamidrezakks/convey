import { Activity, Globe, RotateCcw, Scale, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { Badge } from '../ui/Badge';

export function FeatureGrid() {
  const features = [
    {
      icon: ShieldCheck,
      color: 'emerald',
      title: 'AES-256-GCM Payload Encryption',
      tag: 'Storage Security',
      description:
        'Recipient handles and message payloads use authenticated encryption before database storage. Authorized API reads and workers decrypt payloads when needed; key management is an operator responsibility.',
    },
    {
      icon: Zap,
      color: 'sky',
      title: 'Scoped Idempotency Reservations',
      tag: '24h Default Retention',
      description:
        'Team and sandbox scope isolate retained keys. Completed identical requests replay the saved acceptance response; different payloads and requests still processing return a conflict.',
    },
    {
      icon: Scale,
      color: 'amber',
      title: 'Multi-Tenant Dispatch Scheduling',
      tag: 'Queue Control',
      description:
        'Priority queues and Deficit Round Robin scheduling support configured tenant weights. Local fairness tests exercise the scheduler; delivery timing depends on the deployment and providers.',
    },
    {
      icon: RotateCcw,
      color: 'rose',
      title: 'Dead-Letter Inspection & Replay',
      tag: 'Operator Recovery',
      description:
        'Inspect failed work, preview replay impact, and intentionally create a new execution. Replaying an uncertain delivery may produce another message and charge.',
    },
    {
      icon: Activity,
      color: 'purple',
      title: 'Circuit Breakers & Recovery Ramps',
      tag: 'Provider Resilience',
      description:
        'Health tracking and bounded retries respond to transient errors and throttling. Half-open admission tests support recovery; third-party networks can leave acceptance uncertain.',
    },
    {
      icon: Globe,
      color: 'cyan',
      title: 'Optional Go Recipient Gateway',
      tag: 'Recipient Delivery',
      description:
        'The independent Go gateway resolves missing delivery addresses from your customer service using a userId, verifies caller scope with Convey, and forwards single or bulk submissions.',
    },
  ];

  return (
    <section className="py-16 sm:py-20 bg-[#070b12]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <Badge variant="primary" size="md">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Communication Service Building Blocks</span>
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
            Durable Acceptance & Configurable Dispatch
          </h2>
          <p className="text-xs sm:text-base text-slate-400">
            Convey combines PostgreSQL, Redis-compatible queues, workers, and provider transports. Current qualification
            is local and mock-only.
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
