import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Plus, Webhook } from 'lucide-react';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { type ColumnDef, DataTable, DataTableCopyCell } from '../components/ui/data-table';
import { useI18n } from '../i18n/context';
import { api } from '../lib/api';

interface DeliveryAttemptRow {
  eventId: string;
  event: string;
  endpoint: string;
  status: string;
  latencyMs: number;
  timestamp: string;
}

export function WebhooksPage() {
  const { t } = useI18n();

  const { data: webhooksData, isLoading } = useQuery({
    queryKey: ['admin', 'webhook-subscriptions'],
    queryFn: () => api.getWebhookSubscriptions(),
  });

  const subscriptions = webhooksData?.subscriptions ?? [];

  // Declarative Column Definitions for Subscriptions Table
  const subscriptionColumns: ColumnDef<(typeof subscriptions)[number]>[] = useMemo(
    () => [
      {
        id: 'id',
        accessorKey: 'id',
        header: 'Subscription ID',
        cell: ({ row }) => (
          <DataTableCopyCell
            value={row.id}
            tooltip={t('common.copy')}
            className="text-sky-600 dark:text-sky-300 font-semibold"
          />
        ),
      },
      {
        id: 'url',
        accessorKey: 'url',
        header: t('webhooks.colEndpoint'),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-900 dark:text-white truncate max-w-xs block">{row.url}</span>
        ),
      },
      {
        id: 'events',
        header: t('webhooks.colEvents'),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.events.map((ev) => (
              <span
                key={ev}
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono"
              >
                {ev}
              </span>
            ))}
          </div>
        ),
      },
      {
        id: 'secret',
        header: t('webhooks.colSecret'),
        cell: ({ row }) => (
          <DataTableCopyCell
            value={row.secret}
            displayValue={`${row.secret.slice(0, 14)}...`}
            tooltip={t('common.copy')}
            className="text-amber-600 dark:text-amber-400 font-mono"
          />
        ),
      },
      {
        id: 'successRate',
        header: t('webhooks.colSuccessRate'),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
            {row.successRate || '100.0%'}
          </span>
        ),
      },
      {
        id: 'avgLatencyMs',
        header: t('webhooks.colLatency'),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{row.avgLatencyMs || 35}ms</span>
        ),
      },
      {
        id: 'active',
        header: t('webhooks.colStatus'),
        cell: ({ row }) => (
          <Badge variant={row.active ? 'success' : 'default'} dot>
            {row.active ? 'ACTIVE' : 'INACTIVE'}
          </Badge>
        ),
      },
    ],
    [t],
  );

  // Declarative Column Definitions for Recent Deliveries Table
  const deliveryColumns: ColumnDef<DeliveryAttemptRow>[] = useMemo(
    () => [
      {
        id: 'eventId',
        accessorKey: 'eventId',
        header: 'Event ID',
        cell: ({ row }) => <span className="font-mono text-xs text-sky-600 dark:text-sky-400">{row.eventId}</span>,
      },
      {
        id: 'event',
        accessorKey: 'event',
        header: t('webhooks.colEvents'),
        cell: ({ row }) => <Badge variant="cyan">{row.event}</Badge>,
      },
      {
        id: 'endpoint',
        accessorKey: 'endpoint',
        header: t('webhooks.colEndpoint'),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300 truncate max-w-xs block">
            {row.endpoint}
          </span>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: t('webhooks.colStatus'),
        cell: ({ row }) => <Badge variant="success">{row.status}</Badge>,
      },
      {
        id: 'latencyMs',
        accessorKey: 'latencyMs',
        header: t('webhooks.colLatency'),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{row.latencyMs}ms</span>
        ),
      },
      {
        id: 'timestamp',
        accessorKey: 'timestamp',
        header: t('common.timestamp'),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{row.timestamp}</span>
        ),
      },
    ],
    [t],
  );

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
          variant="primary"
          size="sm"
          className="text-xs gap-1.5 font-semibold rounded-xl shadow-2xs"
          onClick={() => toast.info('New subscription wizard')}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('webhooks.newEndpoint')}</span>
        </Button>
      </div>

      {/* Webhook Endpoints Table */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {t('webhooks.configuredSubscriptions')} ({subscriptions.length})
        </h3>
        <DataTable
          columns={subscriptionColumns}
          data={subscriptions}
          isLoading={isLoading}
          getRowKey={(sub) => sub.id}
          emptyState={{
            icon: <CheckCircle2 className="w-8 h-8 text-emerald-500" />,
            title: 'No webhook subscriptions registered yet',
            description: 'Register an HTTPS webhook endpoint to receive real-time message delivery receipts.',
          }}
        />
      </div>

      {/* Recent Delivery Attempts Log */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {t('webhooks.recentDeliveries')}
        </h3>
        <DataTable
          columns={deliveryColumns}
          data={[] as DeliveryAttemptRow[]}
          density="compact"
          emptyState={{
            icon: <CheckCircle2 className="w-8 h-8 text-emerald-500" />,
            title: 'Live delivery streaming ready',
            description: 'Live delivery receipts are streamed via WebSocket / SSE connection.',
          }}
        />
      </div>
    </div>
  );
}
