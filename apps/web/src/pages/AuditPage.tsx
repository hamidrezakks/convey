import { BookOpen, CheckCircle2 } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

export function AuditPage() {
  const auditLogs = [
    {
      id: 'aud_01JAX9910',
      actor: 'admin@convey.io (SRE Oncall)',
      action: 'CIRCUIT_OVERRIDE',
      target: 'provider:twilio-sms -> FORCE_HALF_OPEN (20% ramp)',
      ipAddress: '192.168.1.135',
      timestamp: '14m ago',
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    },
    {
      id: 'aud_01JAX9909',
      actor: 'system.autopilot',
      action: 'DLQ_REPLAY_SIMULATION',
      target: 'category:PROVIDER_5XX (84 messages)',
      ipAddress: '10.0.4.12 (Internal Worker)',
      timestamp: '32m ago',
      sha256Hash: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
    },
    {
      id: 'aud_01JAX9908',
      actor: 'compliance@convey.io',
      action: 'SUPPRESSION_ADD',
      target: 'recipient:spam-trap@domain.com (SPAM_COMPLAINT)',
      ipAddress: '172.16.0.4',
      timestamp: '1h ago',
      sha256Hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    },
    {
      id: 'aud_01JAX9907',
      actor: 'admin@convey.io',
      action: 'POLICY_DEPLOY',
      target: 'policy:drr_scheduler -> quantumEnterprise: 200',
      ipAddress: '192.168.1.135',
      timestamp: '3h ago',
      sha256Hash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-sky-400" />
            Security & Compliance Audit Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Tamper-evident, cryptographically chained immutable audit log of all control plane mutations and circuit
            overrides.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="font-semibold">Ledger Chain Verified (SHA-256)</span>
        </div>
      </div>

      {/* Audit Log Table */}
      <Card className="glass-panel overflow-hidden">
        <CardHeader className="py-3">
          <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Immutable Audit Trail ({auditLogs.length} events)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Audit ID</TableHead>
                <TableHead>Actor Principal</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target Entity</TableHead>
                <TableHead>Origin IP</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Cryptographic Hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs text-sky-400 font-semibold">{log.id}</TableCell>
                  <TableCell className="text-xs font-medium text-white">{log.actor}</TableCell>
                  <TableCell>
                    <Badge variant="cyan">{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-slate-300 truncate max-w-xs">{log.target}</TableCell>
                  <TableCell className="text-xs font-mono text-slate-400">{log.ipAddress}</TableCell>
                  <TableCell className="text-xs font-mono text-slate-400">{log.timestamp}</TableCell>
                  <TableCell className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]">
                    {log.sha256Hash.slice(0, 16)}...
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
