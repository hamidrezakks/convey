import { useQuery } from '@tanstack/react-query';
import { BookOpen, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { type ColumnDef, DataTable, DataTableCopyCell } from '../components/ui/data-table';
import { useI18n } from '../i18n/context';
import { api } from '../lib/api';
import { formatTimeAgo } from '../lib/utils';

export function AuditPage() {
  const { t } = useI18n();

  const {
    data: auditData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'audit-logs'],
    queryFn: () => api.getAuditLogs({ limit: 50 }),
  });

  const auditLogs = auditData?.logs ?? [];
  const total = auditData?.total ?? 0;

  // Declarative Column Definitions for Audit Log Table
  const columns: ColumnDef<(typeof auditLogs)[number]>[] = useMemo(
    () => [
      {
        id: 'id',
        accessorKey: 'id',
        header: t('audit.colId'),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-sky-600 dark:text-sky-400 font-semibold">{row.id}</span>
        ),
      },
      {
        id: 'actor',
        accessorKey: 'actor',
        header: t('audit.colActor'),
        cell: ({ row }) => <span className="text-xs font-medium text-slate-900 dark:text-white">{row.actor}</span>,
      },
      {
        id: 'action',
        accessorKey: 'action',
        header: t('audit.colAction'),
        cell: ({ row }) => <Badge variant="cyan">{row.action}</Badge>,
      },
      {
        id: 'target',
        accessorKey: 'target',
        header: t('audit.colTarget'),
        cell: ({ row }) => (
          <span className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate max-w-xs block">
            {row.target}
          </span>
        ),
      },
      {
        id: 'ipAddress',
        accessorKey: 'ipAddress',
        header: t('audit.colIp'),
        cell: ({ row }) => (
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{row.ipAddress || '127.0.0.1'}</span>
        ),
      },
      {
        id: 'timestamp',
        accessorKey: 'timestamp',
        header: t('audit.colTime'),
        cell: ({ row }) => (
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{formatTimeAgo(row.timestamp)}</span>
        ),
      },
      {
        id: 'sha256Hash',
        header: t('audit.colHash'),
        cell: ({ row }) =>
          row.sha256Hash ? (
            <DataTableCopyCell
              value={row.sha256Hash}
              tooltip="Copy SHA-256 Hash"
              className="text-[11px] text-slate-500 dark:text-slate-400 font-mono"
            />
          ) : (
            <span className="text-[10px] font-mono text-slate-400">N/A</span>
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
            <BookOpen className="w-5 h-5 text-sky-500 dark:text-sky-400" />
            {t('audit.title')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('audit.subtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="font-semibold">{t('audit.verifiedChain')}</span>
          </div>

          <Button variant="secondary" size="sm" onClick={() => refetch()} className="gap-1.5 text-xs rounded-xl">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t('audit.ledger')} ({total} events)
          </h3>
          <span className="text-xs text-slate-500 font-mono">SHA-256 Tamper-Evident Ledger</span>
        </div>

        <DataTable
          columns={columns}
          data={auditLogs}
          isLoading={isLoading}
          getRowKey={(log) => log.id}
          emptyState={{
            icon: <CheckCircle2 className="w-8 h-8 text-emerald-500" />,
            title: 'No audit records recorded yet',
            description: 'Administrative actions and ledger alterations will be recorded here.',
          }}
        />
      </div>
    </div>
  );
}
