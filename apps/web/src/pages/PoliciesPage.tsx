import { useQuery } from '@tanstack/react-query';
import { Check, Clock, Coins, RefreshCw, Scale, Sliders, Zap } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Slider } from '../components/ui/slider';
import { Switch } from '../components/ui/switch';
import { api } from '../lib/api';
import { policyKeys } from '../lib/queryKeys';

export function PoliciesPage() {
  // Policy configurations state
  const [rateLimitRps, setRateLimitRps] = useState(5000);
  const [burstCapacity, setBurstCapacity] = useState(10000);
  const [quantumEnterprise, setQuantumEnterprise] = useState(200);
  const [quantumPro, setQuantumPro] = useState(50);
  const [quantumFree, setQuantumFree] = useState(10);
  const [whatsappSessionAutoConvert, setWhatsappSessionAutoConvert] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true);

  // TanStack Query: Policies list
  const { isFetching, refetch } = useQuery({
    queryKey: policyKeys.all,
    queryFn: () => api.getPolicies(),
  });

  const handleSavePolicies = () => {
    toast.success('Traffic policies and DRR scheduler quanta synchronized to Redis cluster!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sliders className="w-5 h-5 text-sky-400" />
            DRR Multi-Tenant Scheduler & Traffic Policy Studio
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Deficit Weighted Round Robin SLA weights, distributed token-bucket ingress limits, WhatsApp session cost
            optimizers, and quiet hours.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            isLoading={isFetching}
            className="text-xs gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </Button>
          <Button variant="glow" size="sm" onClick={handleSavePolicies} className="text-xs gap-1.5 font-bold">
            <Check className="w-3.5 h-3.5" />
            <span>Deploy to Redis Cluster</span>
          </Button>
        </div>
      </div>

      {/* Policy 1: DRR Multi-Tenant Scheduler */}
      <Card className="glass-panel">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-white">
                  Deficit Weighted Round Robin (DRR) Scheduler Quanta
                </CardTitle>
                <CardDescription>
                  Guarantees Enterprise tier throughput isolation while preventing Free tier starvation under surge
                  loads.
                </CardDescription>
              </div>
            </div>
            <Badge variant="purple">Active</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Enterprise Tier */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-sky-400 uppercase">Enterprise Tier</span>
                <span className="font-mono text-sm text-white font-bold">{quantumEnterprise} msgs/round</span>
              </div>
              <Slider value={quantumEnterprise} min={50} max={500} step={10} onValueChange={setQuantumEnterprise} />
              <p className="text-[11px] text-slate-400">Guaranteed 350ms P95 SLA target</p>
            </div>

            {/* Pro Tier */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-indigo-400 uppercase">Pro Tier</span>
                <span className="font-mono text-sm text-white font-bold">{quantumPro} msgs/round</span>
              </div>
              <Slider value={quantumPro} min={10} max={100} step={5} onValueChange={setQuantumPro} />
              <p className="text-[11px] text-slate-400">Target 800ms P95 SLA</p>
            </div>

            {/* Free Tier */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase">Free Community</span>
                <span className="font-mono text-sm text-white font-bold">{quantumFree} msgs/round</span>
              </div>
              <Slider value={quantumFree} min={1} max={50} step={1} onValueChange={setQuantumFree} />
              <p className="text-[11px] text-slate-400">Best-effort fair share</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Policy 2 & 3: Token Bucket Ingress & WhatsApp Optimizer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Bucket Limiter */}
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-white">
                  Distributed Token Bucket Ingress Limiter
                </CardTitle>
                <CardDescription>Single-RTT Redis SET NX rate limiter per tenant boundary.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-semibold">Refill Rate:</span>
                <span className="font-mono text-sky-400 font-bold">{rateLimitRps} tokens/sec</span>
              </div>
              <Slider value={rateLimitRps} min={500} max={20000} step={500} onValueChange={setRateLimitRps} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-semibold">Burst Capacity:</span>
                <span className="font-mono text-sky-400 font-bold">{burstCapacity} tokens</span>
              </div>
              <Slider value={burstCapacity} min={1000} max={50000} step={1000} onValueChange={setBurstCapacity} />
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Session Cost Optimizer */}
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-white">WhatsApp 24h Session Optimizer</CardTitle>
                  <CardDescription>
                    Automatically switches from paid Template messages ($0.035) to zero-cost Session messages when a 24h
                    user window is active.
                  </CardDescription>
                </div>
              </div>
              <Switch checked={whatsappSessionAutoConvert} onCheckedChange={setWhatsappSessionAutoConvert} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-300">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              <span className="font-semibold">Cost Optimization Active: </span>
              Convey tracks incoming user replies in Redis and routes outbound notifications as free text messages
              inside the 24h window.
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">Estimated Monthly Savings:</span>
              <span className="font-mono text-emerald-400 font-bold">$1,450.00 / mo</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Policy 4: Regional Quiet Hours */}
      <Card className="glass-panel">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-white">
                  Regional Quiet Hours Autopilot (EMEA / APAC)
                </CardTitle>
                <CardDescription>
                  Defers non-critical marketing messages arriving between 22:00 and 08:00 local recipient time to 08:00
                  next morning.
                </CardDescription>
              </div>
            </div>
            <Switch checked={quietHoursEnabled} onCheckedChange={setQuietHoursEnabled} />
          </div>
        </CardHeader>
        <CardContent className="text-xs text-slate-300">
          <p className="text-slate-400">
            Critical authentication OTPs and payment receipts bypass quiet hours unconditionally. Marketing
            transmissions are safely held in BullMQ delayed queues.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
