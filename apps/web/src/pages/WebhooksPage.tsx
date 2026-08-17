import { Check, Key, Plus, Webhook } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { useI18n } from '../i18n/context';

export function WebhooksPage() {
  const { t } = useI18n();
  const [copiedSecretId, setCopiedSecretId] = useState<string | null>(null);

  const subscriptions = [
    {
      id: 'sub_01JAX1001',
      endpointUrl: 'https://api.merchant.com/webhooks/convey',
      events: ['message.delivered', 'message.failed', 'message.bounced'],
      secret: 'whsec_89f92a104cb1a48c909e7c5b19e2',
      status: 'ACTIVE',
      successRate: '99.94%',
      avgLatencyMs: 38,
    },
    {
      id: 'sub_01JAX1002',
      endpointUrl: 'https://hooks.slack.com/services/T00/B00/XXXXX',
      events: ['provider.circuit_open', 'dlq.threshold_exceeded'],
      secret: 'whsec_110a88fbca290e8c11928fa8192a',
      status: 'ACTIVE',
      successRate: '100.0%',
      avgLatencyMs: 82,
    },
  ];

  const recentDeliveries = [
    {
      id: 'del_01JAX9901',
      event: 'message.delivered',
      target: 'https://api.merchant.com/webhooks/convey',
      responseCode: 200,
      latencyMs: 34,
      timestamp: '2m ago',
    },
    {
      id: 'del_01JAX9900',
      event: 'message.delivered',
      target: 'https://api.merchant.com/webhooks/convey',
      responseCode: 200,
      latencyMs: 41,
      timestamp: '5m ago',
    },
    {
      id: 'del_01JAX9899',
      event: 'provider.circuit_open',
      target: 'https://hooks.slack.com/services/T00/B00/XXXXX',
      responseCode: 200,
      latencyMs: 89,
      timestamp: '14m ago',
    },
  ];

  const handleCopySecret = (id: string, secret: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedSecretId(id);
    toast.success(t('webhooks.copySecretSuccess'));
    setTimeout(() => setCopiedSecretId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Webhook className="w-5 h-5 text-sky-500 dark:text-sky-400" />
            {t('webhooks.title')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('webhooks.subtitle')}</p>
        </div>

        <Button
          variant="glow"
          size="sm"
          className="text-xs gap-1.5 font-bold"
          onClick={() => toast.info('New subscription wizard')}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('webhooks.newEndpoint')}</span>
        </Button>
      </div>

      {/* Webhook Endpoints Table */}
      <Card className="glass-panel overflow-hidden">
        <CardHeader className="py-3">
          <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t('webhooks.configuredSubscriptions')} ({subscriptions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subscription ID</TableHead>
                <TableHead>{t('webhooks.colEndpoint')}</TableHead>
                <TableHead>{t('webhooks.colEvents')}</TableHead>
                <TableHead>{t('webhooks.colSecret')}</TableHead>
                <TableHead>{t('webhooks.colSuccessRate')}</TableHead>
                <TableHead>{t('webhooks.colLatency')}</TableHead>
                <TableHead>{t('webhooks.colStatus')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-mono text-xs text-sky-600 dark:text-sky-300 font-semibold">
                    {sub.id}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-900 dark:text-white truncate max-w-xs">
                    {sub.endpointUrl}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {sub.events.map((ev) => (
                        <span
                          key={ev}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => handleCopySecret(sub.id, sub.secret)}
                      className="flex items-center gap-1 font-mono text-xs text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-300 transition-colors cursor-pointer"
                      title={t('common.copy')}
                    >
                      {copiedSecretId === sub.id ? (
                        <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                      ) : (
                        <Key className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                      )}
                      <span>{sub.secret.slice(0, 14)}...</span>
                    </button>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
                    {sub.successRate}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-700 dark:text-slate-300">
                    {sub.avgLatencyMs}ms
                  </TableCell>
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
          <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t('webhooks.recentDeliveries')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event ID</TableHead>
                <TableHead>{t('webhooks.colEvents')}</TableHead>
                <TableHead>{t('webhooks.colEndpoint')}</TableHead>
                <TableHead>{t('webhooks.colStatus')}</TableHead>
                <TableHead>{t('webhooks.colLatency')}</TableHead>
                <TableHead>{t('common.timestamp')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentDeliveries.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400">{d.id}</TableCell>
                  <TableCell className="font-mono text-xs text-sky-600 dark:text-sky-300 font-medium">
                    {d.event}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-700 dark:text-slate-300">{d.target}</TableCell>
                  <TableCell>
                    <Badge variant="success">{d.responseCode} OK</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
                    {d.latencyMs}ms
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 dark:text-slate-400 font-mono">{d.timestamp}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
