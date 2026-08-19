import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Channel, SuppressionReason } from '@convey/shared';
import { adminService } from '../src/modules/admin/admin.service';
import { setupFreshIsolatedDatabase } from './helpers/fresh-db-runner';
import { disableProviderMock, enableProviderMock } from './mocks/provider-mock';

describe('Admin Service & Sandbox Isolation Suite', () => {
  beforeAll(async () => {
    await setupFreshIsolatedDatabase();
    enableProviderMock(0.0);
  });

  afterAll(async () => {
    disableProviderMock();
  });

  it('1. Overview returns real database counts without fake numbers when DB is empty', async () => {
    const overview = await adminService.getOverview();
    expect(overview.status).toBeDefined();
    expect(overview.metrics24h.totalIngested).toBe(0);
    expect(overview.metrics24h.delivered).toBe(0);
    expect(overview.metrics24h.failed).toBe(0);
    expect(overview.deliverySuccessRatePercent).toBe(100.0);
  });

  it('2. Live telemetry snapshot returns real runtime metrics and non-random queue depths', async () => {
    const snap = await adminService.getLiveTelemetrySnapshot();
    expect(snap.timestamp).toBeDefined();
    expect(snap.runtimeGuard.v8HeapUsedMb).toBeGreaterThan(0);
    expect(snap.runtimeGuard.v8HeapTotalMb).toBeGreaterThan(0);
    expect(snap.queues.outboxRelayDepth).toBe(0);
  });

  it('3. listMessages returns empty array when no messages exist (no simulated messages)', async () => {
    const res = await adminService.listMessages({ page: 1, limit: 10 });
    expect(res.messages).toEqual([]);
    expect(res.total).toBe(0);
  });

  it('4. sendTestMessage creates a real traceable sandbox record in PostgreSQL', async () => {
    const res = await adminService.sendTestMessage({
      channel: Channel.EMAIL,
      recipient: 'sandbox-user@example.com',
      payload: { subject: 'Sandbox Test Email', text: 'Hello from sandbox' },
      teamId: 'sandbox_team',
      isSandbox: true,
    });

    expect(res.publicId).toBeDefined();
    expect(res.publicId.startsWith('msg_')).toBe(true);
    expect(res.isSandbox).toBe(true);
    expect(res.status).toBe('ACCEPTED');

    // Query messages specifically for Sandbox
    const sandboxList = await adminService.listMessages({ isSandbox: true });
    expect(sandboxList.total).toBe(1);
    expect(sandboxList.messages[0].publicId).toBe(res.publicId);
    expect(sandboxList.messages[0].isSandbox).toBe(true);

    // Query messages specifically for Production (must be 0!)
    const prodList = await adminService.listMessages({ isSandbox: false });
    expect(prodList.total).toBe(0);

    // Fetch details for the message
    const details = await adminService.getMessageDetails(res.publicId);
    expect(details).not.toBeNull();
    expect(details?.publicId).toBe(res.publicId);
    expect(details?.isSandbox).toBe(true);
    expect(details?.spans.length).toBeGreaterThan(0);
  });

  it('5. getMessageDetails returns null for nonexistent message ID', async () => {
    const nonexistent = await adminService.getMessageDetails('msg_nonexistent_9999');
    expect(nonexistent).toBeNull();
  });

  it('6. Audit logs record administrative operations with cryptographic SHA-256 hashes', async () => {
    // Add suppression
    await adminService.addSuppression({
      teamId: 'sandbox_team',
      recipient: 'suppressed@example.com',
      channel: Channel.EMAIL,
      reason: SuppressionReason.MANUAL_BLOCK,
    });

    const auditRes = await adminService.listAuditLogs({ page: 1, limit: 10 });
    expect(auditRes.total).toBeGreaterThan(0);
    const log = auditRes.logs.find((l) => l.action === 'SUPPRESSION_ADD');
    expect(log).toBeDefined();
    expect(log?.sha256Hash).toBeDefined();
    expect(log?.sha256Hash.length).toBe(64);
  });
});
