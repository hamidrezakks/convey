import { Key, Plus, Webhook } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

export function WebhooksPage() {
  const [_copiedSecret, setCopiedSecret] = useState(false);

  const subscriptions = [
    {
      id: 'sub_wh_01JAX01',
      endpointUrl: 'https://api.acme-corp.com/v1/convey/webhooks',
      events: ['message.delivered', 'message.failed', 'message.bounced'],
      status: 'ACTIVE',
      secret: 'whsec_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      successRate: '99.9%',
      avgLatencyMs: 42.1,
    },
    {
      id: 'sub_wh_01JAX02',
      endpointUrl: 'https://security.global-fintech.io/hooks/dlr',
      events: ['message.delivered'],
      status: 'ACTIVE',
      secret: 'whsec_7d5a5da98e6c429598fc1c149afbf4c8996fb92427ae41e4649b934ca495991b',
      successRate: '100.0%',
      avgLatencyMs: 28.4,
    },
  ];

  const recentDeliveries = [
    {
      id: 'wh_evt_81920',
      event: 'message.delivered',
      target: 'https://api.acme-corp.com/...',
      responseCode: 200,
      latencyMs: 38.2,
      attempts: 1,
      timestamp: '1m ago',
    },
    {
      id: 'wh_evt_81919',
      event: 'message.bounced',
      target: 'https://api.acme-corp.com/...',
      responseCode: 200,
      latencyMs: 45.1,
      attempts: 1,
      timestamp: '4m ago',
    },
    {
      id: 'wh_evt_81918',
      event: 'message.delivered',
      target: 'https://security.global-fintech.io/...',
      responseCode: 200,
      latencyMs: 26.8,
      attempts: 1,
      timestamp: '8m ago',
    },
  ];

  const handleCopySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    toast.success('Webhook HMAC signing secret copied to clipboard');
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Webhook className="w-5 h-5 text-sky-400" />
            Webhook Subscriptions & Delivery Inspector
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time delivery receipts (DLR), cryptographic HMAC-SHA256 payload signatures, and automatic jittered
            retry relays.
          </p>
        </div>

        <Button
          variant="glow"
          size="sm"
          className="text-xs gap-1.5 font-bold"
          onClick={() => toast.info('New subscription wizard opened')}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Webhook Endpoint</span>
        </Button>
      </div>

      {/* Webhook Endpoints Table */}
      <Card className="glass-panel overflow-hidden">
        <CardHeader className="py-3">
          <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Configured Subscriptions ({subscriptions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subscription ID</TableHead>
                <TableHead>Target Endpoint</TableHead>
                <TableHead>Subscribed Events</TableHead>
                <TableHead>HMAC Secret</TableHead>
                <TableHead>Success Rate</TableHead>
                <TableHead>Avg Latency</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-mono text-xs text-sky-300 font-semibold">{sub.id}</TableCell>
                  <TableCell className="font-mono text-xs text-white truncate max-w-xs">{sub.endpointUrl}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {sub.events.map((ev) => (
                        <span
                          key={ev}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => handleCopySecret(sub.secret)}
                      className="flex items-center gap-1 font-mono text-xs text-slate-400 hover:text-sky-300 transition-colors"
                      title="Copy HMAC secret"
                    >
                      <Key className="w-3 h-3 text-amber-400" />
                      <span>{sub.secret.slice(0, 14)}...</span>
                    </button>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-emerald-400">{sub.successRate}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">{sub.avgLatencyMs}ms</TableCell>
                  <TableCell>
                    <Badge variant="success" dot>
                      {sub.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Delivery Attempts Log */}
      <Card className="glass-panel overflow-hidden">
        <CardHeader className="py-3">
          <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Recent Delivery Receipts (DLR)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event ID</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Target URL</TableHead>
                <TableHead>HTTP Status</TableHead>
                <TableHead>Round-Trip Latency</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentDeliveries.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs text-slate-400">{d.id}</TableCell>
                  <TableCell className="font-mono text-xs text-sky-300 font-medium">{d.event}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">{d.target}</TableCell>
                  <TableCell>
                    <Badge variant="success">{d.responseCode} OK</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-emerald-400">{d.latencyMs}ms</TableCell>
                  <TableCell className="text-xs text-slate-400 font-mono">{d.timestamp}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
