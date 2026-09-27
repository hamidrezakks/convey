import { afterAll, describe, expect, it, spyOn } from 'bun:test';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../src/db';
import {
  budgetLedger,
  budgetPolicies,
  budgetReservations,
  budgetUsage,
  messageAttempts,
  messageEvents,
  messages,
  outbox,
  teamOwners,
  tenants,
} from '../src/db/schema';
import { DlqService } from '../src/modules/messaging/dlq.service';
import { AttemptOrigin, Channel, MessagePriority, MessageState } from '../src/modules/messaging/messaging.types';
import { BudgetService } from '../src/modules/policies/budget.service';
import { estimateBudgetUnits } from '../src/modules/policies/budget-estimate';
import { PolicyEngine } from '../src/modules/policies/policy-engine';
import { providerCircuitBreaker } from '../src/modules/providers/core/circuit-breaker';
import { ProviderRegistry } from '../src/modules/providers/core/provider-registry';
import { ErrorCategory } from '../src/modules/providers/core/provider-types';
import { twilioSmsModule } from '../src/modules/providers/sms/twilio';
import { ReportingService } from '../src/modules/reports/reporting.service';
import { processProviderSendJob } from '../src/queues/workers/provider-send.worker';
import { generateMessageId } from '../src/utils/id';

const prefix = `budget_${crypto.randomUUID()}`;
const teams: string[] = [];
async function policy(limit: string, currency = 'USD', hardStop = true) {
  const team = `${prefix}_${teams.length}`;
  teams.push(team);
  await db
    .insert(budgetPolicies)
    .values({ id: team, team, currency, monthlyBudgetUsd: limit, hardStop: String(hardStop) });
  return team;
}
function charge(team: string, amount = 0.01, key = crypto.randomUUID()) {
  return { key, team, amount, messageId: generateMessageId(), channel: 'sms', providerId: 'test', currency: 'USD' };
}
afterAll(async () => {
  for (const team of teams) {
    const seeded = await db
      .select({ id: messages.publicId })
      .from(messages)
      .where(and(eq(messages.team, team), sql`${messages.createdAt} >= date_trunc('month', now())`));
    for (const row of seeded) {
      await db.delete(outbox).where(eq(outbox.messageId, row.id));
      await db
        .delete(messageAttempts)
        .where(
          and(eq(messageAttempts.messageId, row.id), sql`${messageAttempts.createdAt} >= date_trunc('month', now())`),
        );
      await db
        .delete(messageEvents)
        .where(and(eq(messageEvents.messageId, row.id), sql`${messageEvents.createdAt} >= date_trunc('month', now())`));
    }
    await db
      .delete(messages)
      .where(and(eq(messages.team, team), sql`${messages.createdAt} >= date_trunc('month', now())`));
    await db
      .delete(budgetLedger)
      .where(
        and(
          eq(budgetLedger.team, team),
          sql`${budgetLedger.createdAt} >= date_trunc('month', now()) - interval '1 month'`,
          sql`${budgetLedger.createdAt} < date_trunc('month', now()) + interval '1 month'`,
        ),
      );
    await db.delete(budgetReservations).where(eq(budgetReservations.team, team));
    await db.delete(budgetUsage).where(eq(budgetUsage.policyId, team));
    await db.delete(budgetPolicies).where(eq(budgetPolicies.team, team));
  }
});
describe('Durable budget enforcement', () => {
  it('worker releases single rejections, retains possible bulk acceptance and bypasses sandbox charging', async () => {
    ProviderRegistry.registerModule(twilioSmsModule);
    const send = spyOn(twilioSmsModule.adapter, 'send').mockResolvedValue({
      success: false,
      error: { code: 'MISSING_CREDENTIALS', message: 'Rejected', category: ErrorCategory.PERMANENT },
    });
    try {
      for (const mode of ['single', 'bulk', 'sandbox', 'uncertain']) {
        if (mode === 'uncertain')
          send.mockResolvedValue({
            success: false,
            error: {
              code: 'UNRECOGNIZED_RESPONSE',
              message: 'Unrecognized response',
              category: ErrorCategory.PERMANENT,
            },
          });
        const team = await policy('1');
        const id = generateMessageId();
        await db.insert(messages).values({
          id,
          publicId: id,
          team,
          userId: 'budget-test',
          category: 'transactional',
          country: 'US',
          priority: MessagePriority.NORMAL,
          state: MessageState.DISPATCHED,
          isSandbox: mode === 'sandbox',
          recipients: { phone: '+15550000001' },
          channels: [{ channel: Channel.SMS, content: { text: 'test' } }],
        });
        await processProviderSendJob({
          publicId: id,
          recipient: { phone: mode === 'bulk' ? ['+15550000001', '+15550000002'] : '+15550000001' },
          channel: Channel.SMS,
          providerId: 'twilio',
          origin: AttemptOrigin.INITIAL,
          attemptNo: 1,
        });
        const state = await BudgetService.get(team);
        expect(state?.usedAmount).toBe(0);
        expect(state?.reservedAmount).toBe(mode === 'bulk' ? 0.0158 : mode === 'uncertain' ? 0.0079 : 0);
      }
      expect(send).toHaveBeenCalledTimes(3);
    } finally {
      send.mockRestore();
    }
  });
  it('reports foreign budgets in USD while including holds in utilization', async () => {
    const team = await policy('92.4', 'EUR');
    const paid = await BudgetService.reserve(charge(team, 10));
    await BudgetService.settle(paid.id, 'committed');
    await BudgetService.reserve(charge(team, 5));
    const reports = await ReportingService.getTeamReports({ teamId: team });
    const row = reports.teams.find((item) => item.teamId === team);
    if (!row) throw new Error('Missing report');
    expect(row.usedBudgetUsd).toBe(10);
    expect(row.remainingBudgetUsd).toBe(85);
    expect(row.budgetUtilizationPercent).toBe(15);
  });
  it('carries existing month spend into a new policy and protects in-flight and currency edits', async () => {
    const team = `${prefix}_${teams.length}`;
    teams.push(team);
    const tenant = crypto.randomUUID();
    await db.insert(tenants).values({ id: tenant, name: 'Budget test', slug: team });
    await db.insert(teamOwners).values({ team, tenantId: tenant });
    try {
      const hold = await BudgetService.reserve(charge(team, 10));
      await expect(BudgetService.save(team, { currency: 'EUR', monthlyBudget: 100, hardStop: true })).rejects.toThrow(
        'Reconcile',
      );
      await BudgetService.settle(hold.id, 'committed');
      await BudgetService.save(team, { currency: 'EUR', monthlyBudget: 100, hardStop: true });
      expect((await BudgetService.get(team))?.usedAmount).toBe(9.24);
      await expect(BudgetService.save(team, { currency: 'USD', monthlyBudget: 100, hardStop: true })).rejects.toThrow(
        'currency',
      );
      await BudgetService.save(team, { currency: 'EUR', monthlyBudget: 9, hardStop: true });
      expect((await BudgetService.reserve(charge(team))).allowed).toBe(false);
      const state = await BudgetService.get(team);
      await db.delete(budgetUsage).where(eq(budgetUsage.policyId, state?.id ?? 'missing'));
    } finally {
      await db.delete(teamOwners).where(eq(teamOwners.team, team));
      await db.delete(tenants).where(eq(tenants.id, tenant));
    }
  });
  it('counts GSM extensions, Unicode segments and recipient fan-out', () => {
    const options = {
      id: 'estimate',
      channel: Channel.SMS,
      recipient: { phone: ['+1', '+2'] },
      content: { text: 'a'.repeat(161) },
    };
    expect(estimateBudgetUnits(options)).toBe(4);
    expect(estimateBudgetUnits({ ...options, content: { text: '^'.repeat(81) } })).toBe(4);
    expect(estimateBudgetUnits({ ...options, content: { text: '😀'.repeat(36) } })).toBe(4);
    expect(
      estimateBudgetUnits({
        ...options,
        channel: Channel.EMAIL,
        recipient: { ...options.recipient, email: ['a', 'b', 'c'] },
      }),
    ).toBe(3);
    expect(estimateBudgetUnits({ ...options, content: { text: '^'.repeat(153) } })).toBe(6);
    expect(estimateBudgetUnits({ ...options, content: { text: '😀'.repeat(67) } })).toBe(6);
  });
  it('reserves nonzero amounts for tiny foreign-currency estimates', async () => {
    const team = await policy('1', 'EUR');
    const hold = await BudgetService.reserve(charge(team, 0.000000001));
    expect(hold.allowed).toBe(true);
    expect((await BudgetService.get(team))?.reservedAmount).toBe(0.0001);
  });
  it('blocks the actual provider call before overspending and skips duplicate accepted jobs', async () => {
    const team = await policy('0.0079');
    ProviderRegistry.registerModule(twilioSmsModule);
    const failure = spyOn(providerCircuitBreaker, 'recordFailure');
    const send = spyOn(twilioSmsModule.adapter, 'send').mockResolvedValue({
      success: true,
      providerMessageId: 'budget-provider-id',
    });
    try {
      const jobs = await Promise.all(
        Array.from({ length: 8 }, async () => {
          const id = generateMessageId();
          await db.insert(messages).values({
            id,
            publicId: id,
            team,
            userId: 'budget-test',
            category: 'transactional',
            country: 'US',
            priority: MessagePriority.NORMAL,
            state: MessageState.DISPATCHED,
            recipients: { phone: '+15550000000' },
            channels: [{ channel: Channel.SMS, content: { text: 'test' } }],
          });
          return {
            publicId: id,
            channel: Channel.SMS,
            providerId: 'twilio',
            origin: AttemptOrigin.INITIAL,
            attemptNo: 1,
          };
        }),
      );
      await Promise.all(jobs.map(processProviderSendJob));
      expect(send).toHaveBeenCalledTimes(1);
      expect(failure).not.toHaveBeenCalled();
      expect((await BudgetService.get(team))?.usedAmount).toBe(0.0079);
      const [accepted] = await db.select().from(budgetReservations).where(eq(budgetReservations.team, team));
      const job = jobs.find((job) => job.publicId === accepted.messageId);
      if (!job) throw new Error('Missing accepted job');
      await processProviderSendJob(job);
      expect(send).toHaveBeenCalledTimes(1);
      await db.update(budgetPolicies).set({ monthlyBudgetUsd: '0.0158' }).where(eq(budgetPolicies.team, team));
      await db
        .update(messages)
        .set({ state: MessageState.FAILED })
        .where(and(eq(messages.publicId, job.publicId), sql`${messages.createdAt} >= date_trunc('month', now())`));
      expect((await DlqService.replayFailedMessages([job.publicId])).replayedCount).toBe(1);
      const [replayed] = await db
        .select()
        .from(messages)
        .where(and(eq(messages.publicId, job.publicId), sql`${messages.createdAt} >= date_trunc('month', now())`));
      await processProviderSendJob(job);
      expect(send).toHaveBeenCalledTimes(1);
      const execution = replayed.metadata?._budgetExecutionId;
      if (typeof execution !== 'string') throw new Error('Missing replay generation');
      await processProviderSendJob({ ...job, budgetExecutionId: execution });
      expect(send).toHaveBeenCalledTimes(2);
      expect((await BudgetService.get(team))?.usedAmount).toBe(0.0158);
      expect(failure).not.toHaveBeenCalled();
    } finally {
      send.mockRestore();
      failure.mockRestore();
    }
  });
  it('allows exactly ten of fifty simultaneous sends with ten cents remaining', async () => {
    const team = await policy('0.1000');
    const results = await Promise.all(Array.from({ length: 50 }, () => BudgetService.reserve(charge(team))));
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
    expect((await BudgetService.get(team))?.reservedAmount).toBe(0.1);
    expect((await PolicyEngine.checkBudget(team)).allowed).toBe(false);
    await Promise.all(results.filter((r) => r.allowed).map((r) => BudgetService.settle(r.id, 'committed')));
    const state = await BudgetService.get(team);
    expect(state?.usedAmount).toBe(0.1);
    expect(state?.reservedAmount).toBe(0);
    expect(state?.remainingAmount).toBe(0);
  });
  it('deduplicates concurrent delivery jobs and settlement retries', async () => {
    const team = await policy('1');
    const item = charge(team);
    const results = await Promise.all(Array.from({ length: 20 }, () => BudgetService.reserve(item)));
    expect(results.filter((r) => r.allowed)).toHaveLength(1);
    await Promise.all(results.map((r) => BudgetService.settle(r.id, 'committed')));
    expect((await BudgetService.get(team))?.usedAmount).toBe(0.01);
    const ledger = await db
      .select()
      .from(budgetLedger)
      .where(and(eq(budgetLedger.team, team), sql`${budgetLedger.createdAt} >= date_trunc('month', now())`));
    expect(ledger).toHaveLength(1);
  });
  it('releases definite rejections but keeps uncertain outcomes reserved', async () => {
    const team = await policy('0.02');
    const a = await BudgetService.reserve(charge(team));
    const b = await BudgetService.reserve(charge(team));
    await BudgetService.settle(a.id, 'released');
    await BudgetService.settle(a.id, 'released');
    expect((await BudgetService.get(team))?.reservedAmount).toBe(0.01);
    expect((await BudgetService.reserve(charge(team))).allowed).toBe(true);
    expect((await BudgetService.reserve(charge(team))).allowed).toBe(false);
    await expect(BudgetService.settle(a.id, 'committed')).rejects.toThrow();
    expect(b.allowed).toBe(true);
  });
  it('rolls back usage when ledger insertion fails, then settles exactly once', async () => {
    const team = await policy('1');
    const hold = await BudgetService.reserve(charge(team));
    const [row] = await db.select().from(budgetReservations).where(eq(budgetReservations.id, hold.id));
    await db.insert(budgetLedger).values({
      id: row.id,
      messageId: row.messageId,
      team,
      amountUsd: '0.01',
      channel: 'sms',
      providerId: 'test',
      createdAt: row.createdAt,
    });
    await expect(BudgetService.settle(hold.id, 'committed')).rejects.toThrow();
    expect((await BudgetService.get(team))?.usedAmount).toBe(0);
    expect((await BudgetService.get(team))?.reservedAmount).toBe(0.01);
    await db.delete(budgetLedger).where(and(eq(budgetLedger.id, row.id), eq(budgetLedger.createdAt, row.createdAt)));
    await BudgetService.settle(hold.id, 'committed');
    expect((await BudgetService.get(team))?.usedAmount).toBe(0.01);
  });
  it('pins currency conversion and month at reservation across settlement', async () => {
    const team = await policy('100', 'EUR');
    const when = new Date();
    when.setUTCDate(1);
    when.setUTCMonth(when.getUTCMonth() - 1);
    const hold = await BudgetService.reserve(charge(team, 10), when);
    await BudgetService.settle(hold.id, 'committed');
    expect((await BudgetService.get(team, when))?.usedAmount).toBe(9.24);
    expect((await BudgetService.get(team))?.usedAmount).toBe(0);
  });
  it('supports soft caps, zero caps, free sends and independent teams', async () => {
    const soft = await policy('0', 'USD', false);
    const hard = await policy('0');
    expect((await BudgetService.reserve(charge(soft, 1))).allowed).toBe(true);
    expect((await BudgetService.reserve(charge(hard, 1))).allowed).toBe(false);
    expect((await BudgetService.reserve(charge(hard, 0))).allowed).toBe(true);
  });
  it('rejects corrupt amounts, unknown currencies and duplicate team policies', async () => {
    const team = await policy('1');
    for (const bad of [-1, NaN, Infinity]) await expect(BudgetService.reserve(charge(team, bad))).rejects.toThrow();
    await expect(BudgetService.reserve({ ...charge(team), currency: 'UNKNOWN' })).rejects.toThrow();
    await expect(
      db
        .insert(budgetPolicies)
        .values({ id: `${team}_duplicate`, team, monthlyBudgetUsd: '10' })
        .then((result) => result),
    ).rejects.toThrow();
  });
  it('refuses to relabel existing usage with a new policy currency', async () => {
    const team = await policy('10');
    await db.insert(budgetUsage).values({
      id: `${team}_bad`,
      policyId: team,
      month: new Date().toISOString().slice(0, 7),
      currency: 'EUR',
      usedUsd: '1',
    });
    await expect(BudgetService.reserve(charge(team))).rejects.toThrow('mismatch');
  });
});
