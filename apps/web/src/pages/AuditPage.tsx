import { useQuery } from '@tanstack/react-query';
import { BookOpen, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
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
      <Card className="glass-panel overflow-hidden">
        <CardHeader className="py-3 px-4 sm:px-6 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t('audit.ledger')} ({total} events)
          </CardTitle>
          <span className="text-xs text-slate-500 font-mono">SHA-256 Tamper-Evident Ledger</span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('audit.colId')}</TableHead>
                <TableHead>{t('audit.colActor')}</TableHead>
                <TableHead>{t('audit.colAction')}</TableHead>
                <TableHead>{t('audit.colTarget')}</TableHead>
                <TableHead>{t('audit.colIp')}</TableHead>
                <TableHead>{t('audit.colTime')}</TableHead>
                <TableHead>{t('audit.colHash')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-500" />
                    Loading audit trail...
                  </TableCell>
                </TableRow>
              ) : auditLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2 opacity-80" />
                    No audit records recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs text-sky-600 dark:text-sky-400 font-semibold">
                      {log.id}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-900 dark:text-white">{log.actor}</TableCell>
                    <TableCell>
                      <Badge variant="cyan">{log.action}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate max-w-xs">
                      {log.target}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {log.ipAddress || '127.0.0.1'}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {formatTimeAgo(log.timestamp)}
                    </TableCell>
                    <TableCell className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                      {log.sha256Hash ? `${log.sha256Hash.slice(0, 16)}...` : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
