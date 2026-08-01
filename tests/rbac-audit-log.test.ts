import { describe, expect, it } from 'bun:test';
import { AuditLogService, UserRole } from '../src/modules/auth/audit-log.service';
import { requireRoles } from '../src/modules/auth/auth.middleware';
import { createFreshTestDb } from './helpers/fresh-db-runner';

describe('Granular RBAC & Tamper-Evident Audit Logging', () => {
  it('should enforce role-based access control permissions', () => {
    // Admin has access to everything
    const adminCheck = requireRoles([UserRole.ORG_ADMIN], UserRole.ORG_ADMIN);
    expect(adminCheck.authorized).toBe(true);

    // Developer cannot perform Admin-only actions
    const devCheck = requireRoles([UserRole.ORG_ADMIN], UserRole.DEVELOPER);
    expect(devCheck.authorized).toBe(false);
    expect(devCheck.errorResponse?.status).toBe(403);

    // Support agent can view support endpoints
    const supportCheck = requireRoles([UserRole.SUPPORT_AGENT, UserRole.ORG_ADMIN], UserRole.SUPPORT_AGENT);
    expect(supportCheck.authorized).toBe(true);
  });

  it('should redact sensitive PII for Support Agent views', () => {
    const rawData = {
      messageId: 'msg_123',
      team: 'billing',
      recipients: {
        email: 'customer.john@corporate.com',
        phone: '+15551234567',
        whatsapp: '+15559876543',
      },
    };

    const masked = AuditLogService.maskPiiForSupportRole(rawData);
    expect(masked.recipients.email).toBe('c***@corporate.com');
    expect(masked.recipients.phone).toBe('+155****67');
    expect(masked.recipients.whatsapp).toBe('+155****43');
  });

  it('should record tamper-evident hash-chained audit log entries in DB', async () => {
    const freshDb = await createFreshTestDb();

    const entry1 = await AuditLogService.record({
      tenantId: 'tenant-acme',
      team: 'infra',
      actorId: 'admin_usr_01',
      actorRole: UserRole.ORG_ADMIN,
      action: 'POLICY_UPDATED',
      resourceType: 'budget_policy',
      resourceId: 'pol_123',
      details: { monthlyBudgetUsd: 5000 },
      ipAddress: '192.168.1.1',
    });

    expect(entry1.id).toBeDefined();
    expect(entry1.hash).toBeDefined();
    expect(entry1.prevHash).toBeDefined();

    const entry2 = await AuditLogService.record({
      tenantId: 'tenant-acme',
      team: 'infra',
      actorId: 'admin_usr_01',
      actorRole: UserRole.ORG_ADMIN,
      action: 'DLQ_REPLAY_TRIGGERED',
      resourceType: 'dlq_batch',
      resourceId: 'dlq_99',
      details: { replayedCount: 15 },
      ipAddress: '192.168.1.1',
    });

    // Merkle chain link
    expect(entry2.prevHash).toBe(entry1.hash);

    const logs = await AuditLogService.listLogs({ tenantId: 'tenant-acme' });
    expect(logs.total).toBe(2);
    expect(logs.items.length).toBe(2);

    await freshDb.cleanup();
  });
});
