import { describe, expect, it } from 'bun:test';
import { ConsensusAuditGuard } from '../src/utils/consensus-auditor';

describe('Anti-Entropy Quorum Consensus Auditor', () => {
  it('detects consistent state checksums and heals split-brain state drift using vector clocks', () => {
    const auditor = new ConsensusAuditGuard();
    const stateKey = 'circuit_state_ses';

    const localPayload = { state: 'OPEN', updatedAt: 1000 };
    const remotePayloadSame = { state: 'OPEN', updatedAt: 1000 };
    const report1 = auditor.auditAndHealState(stateKey, localPayload, remotePayloadSame);
    expect(report1.isConsistent).toBe(true);

    const remotePayloadNewer = { state: 'CLOSED', updatedAt: 2000 };
    const report2 = auditor.auditAndHealState(stateKey, localPayload, remotePayloadNewer);
    expect(report2.isConsistent).toBe(false);
    expect(report2.resolvedHash).toBe(auditor.computeChecksum(remotePayloadNewer));
  });
});
