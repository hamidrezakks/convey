import { createHash } from 'node:crypto';
import { type BudgetPolicyDto, getCurrencyMetadata, isSupportedCurrency } from '@convey/shared';
import { and, asc, eq, gte, lt, sql } from 'drizzle-orm';
import { db, type Transaction } from '../../db';
import { budgetLedger, budgetPolicies, budgetReservations, budgetUsage, teamOwners } from '../../db/schema';
import { getUtcMonthString } from '../../utils/date';
import { generateMessageId } from '../../utils/id';
import { fxEngine } from './fx-engine';

export class BudgetError extends Error {}
export interface BudgetCharge {
  key: string;
  messageId: string;
  team: string;
  channel: string;
  providerId: string;
  amount: number;
  currency: string;
}

function amount(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value >= 100_000_000) throw new BudgetError('Invalid budget amount');
  return value.toFixed(4);
}
/** Round estimates up to the accounting quantum so small paid sends cannot become free. */
function estimatedAmount(value: number): string {
  amount(value);
  const [whole, fraction] = value.toFixed(8).split('.');
  const scaled = BigInt(whole) * 100000000n + BigInt(fraction);
  const rounded = (scaled + 9999n) / 10000n;
  return `${rounded / 10000n}.${String(rounded % 10000n).padStart(4, '0')}`;
}
function units(value: string): bigint {
  if (!/^\d+(\.\d{1,4})?$/.test(value)) throw new BudgetError('Invalid stored budget amount');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
}
async function lockTeam(tx: Transaction, team: string) {
  // Shared by policy edits, reservations and settlement. No provider I/O inside this transaction.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${team}, 24001))`);
}
async function policyFor(tx: Transaction, team: string) {
  const policies = await tx.select().from(budgetPolicies).where(eq(budgetPolicies.team, team));
  if (policies.length > 1) throw new BudgetError('Multiple budget policies exist for this team; reconcile them first');
  const policy = policies[0];
  if (policy) {
    units(policy.monthlyBudgetUsd);
    if (!['true', 'false'].includes(policy.hardStop)) throw new BudgetError('Invalid hard-stop setting');
    fxEngine.getRateToUsd(policy.currency);
  }
  return policy;
}
async function totals(tx: Transaction, policyId: string, month: string, currency: string) {
  const rows = await tx
    .select()
    .from(budgetUsage)
    .where(and(eq(budgetUsage.policyId, policyId), eq(budgetUsage.month, month)));
  if (rows.length > 1 || rows.some((row) => row.currency !== currency))
    throw new BudgetError('Budget usage currency or identity mismatch');
  const [held] = await tx
    .select({ total: sql<string>`coalesce(sum(${budgetReservations.amountInPolicyCurrency}), 0)::text` })
    .from(budgetReservations)
    .where(
      and(
        eq(budgetReservations.policyId, policyId),
        eq(budgetReservations.month, month),
        eq(budgetReservations.state, 'reserved'),
      ),
    );
  return { used: rows[0]?.usedUsd ?? '0.0000', reserved: held.total };
}

export const BudgetService = {
  async reserve(
    charge: BudgetCharge,
    now = new Date(),
    enforceLimit = true,
  ): Promise<{ allowed: boolean; id: string; reason?: 'duplicate' | 'budget' }> {
    amount(charge.amount);
    await fxEngine.syncRatesFromRedis();
    const id = createHash('sha256')
      .update(JSON.stringify([charge.team, charge.key]))
      .digest('hex');
    return db.transaction(async (tx) => {
      await lockTeam(tx, charge.team);
      const [existing] = await tx.select().from(budgetReservations).where(eq(budgetReservations.id, id));
      if (existing) return { allowed: false, id, reason: 'duplicate' as const };
      const policy = await policyFor(tx, charge.team);
      const currency = charge.currency.toUpperCase();
      const policyCurrency = policy?.currency ?? 'USD';
      const fx = fxEngine.convert(charge.amount, currency, policyCurrency, 8);
      const minimumEstimate = charge.amount > 0 ? 0.00000001 : 0;
      const converted = estimatedAmount(Math.max(fx.convertedAmount, minimumEstimate));
      const month = getUtcMonthString(now);
      if (policy) {
        const usage = await totals(tx, policy.id, month, policyCurrency);
        if (
          enforceLimit &&
          policy.hardStop === 'true' &&
          units(usage.used) + units(usage.reserved) + units(converted) > units(policy.monthlyBudgetUsd)
        ) {
          return { allowed: false, id, reason: 'budget' as const };
        }
      }
      await tx.insert(budgetReservations).values({
        id,
        messageId: charge.messageId,
        team: charge.team,
        channel: charge.channel,
        providerId: charge.providerId,
        policyId: policy?.id,
        month,
        currency,
        policyCurrency,
        amountUsd: estimatedAmount(Math.max(fx.amountUsd, minimumEstimate)),
        amountInPolicyCurrency: converted,
        exchangeRate: fx.exchangeRate.toFixed(8),
        createdAt: now,
        updatedAt: now,
      });
      return { allowed: true, id };
    });
  },

  async settle(
    id: string,
    outcome: 'committed' | 'released',
    audit?: { team: string; actorId: string; reason: string },
  ): Promise<void> {
    // Resolve the immutable team before acquiring the same lock order as reserve/save.
    const [reference] = await db.select().from(budgetReservations).where(eq(budgetReservations.id, id));
    if (!reference || (audit && reference.team !== audit.team)) throw new BudgetError('Unknown budget reservation');
    if (audit && (!audit.actorId || audit.reason.trim().length < 10 || audit.reason.length > 2000))
      throw new BudgetError('Reconciliation requires an actor and an evidence note of 10–2000 characters');
    await db.transaction(async (tx) => {
      await lockTeam(tx, reference.team);
      const [hold] = await tx.select().from(budgetReservations).where(eq(budgetReservations.id, id));
      if (hold.state === outcome) return;
      if (hold.state !== 'reserved') throw new BudgetError('Budget reservation already settled differently');
      if (audit)
        await tx.execute(
          sql`INSERT INTO budget_reconciliations (reservation_id, team, actor_id, outcome, reason) VALUES (${id}, ${audit.team}, ${audit.actorId}, ${outcome}, ${audit.reason.trim()})`,
        );
      if (outcome === 'committed') {
        if (hold.policyId) {
          await totals(tx, hold.policyId, hold.month, hold.policyCurrency);
          await tx.execute(sql`INSERT INTO budget_usage (id, policy_id, month, currency, used_usd, updated_at)
            VALUES (${`${hold.policyId}_${hold.month}`}, ${hold.policyId}, ${hold.month}, ${hold.policyCurrency}, ${hold.amountInPolicyCurrency}::numeric, now())
            ON CONFLICT (id) DO UPDATE SET used_usd = budget_usage.used_usd + EXCLUDED.used_usd, updated_at = now()`);
        }
        await tx.insert(budgetLedger).values({
          id: hold.id,
          messageId: hold.messageId,
          team: hold.team,
          channel: hold.channel,
          providerId: hold.providerId,
          amountUsd: hold.amountUsd,
          currency: hold.currency,
          exchangeRate: hold.exchangeRate,
          amountInPolicyCurrency: hold.amountInPolicyCurrency,
          createdAt: hold.createdAt,
        });
      }
      await tx
        .update(budgetReservations)
        .set({ state: outcome, updatedAt: new Date() })
        .where(eq(budgetReservations.id, id));
    });
  },

  async listHolds(team: string) {
    const rows = await db
      .select()
      .from(budgetReservations)
      .where(and(eq(budgetReservations.team, team), eq(budgetReservations.state, 'reserved')))
      .orderBy(asc(budgetReservations.createdAt))
      .limit(200);
    return rows.map((row) => ({
      id: row.id,
      messageId: row.messageId,
      providerId: row.providerId,
      amount: row.amountInPolicyCurrency,
      currency: row.policyCurrency,
      createdAt: row.createdAt.toISOString(),
      stale: Date.now() - row.createdAt.getTime() > 3600_000,
    }));
  },

  async get(team: string, now = new Date()): Promise<BudgetPolicyDto | null> {
    return db.transaction(async (tx) => {
      await lockTeam(tx, team);
      const policy = await policyFor(tx, team);
      if (!policy) return null;
      const usage = await totals(tx, policy.id, getUtcMonthString(now), policy.currency);
      return {
        id: policy.id,
        teamId: team,
        monthlyBudget: Number(policy.monthlyBudgetUsd),
        currency: policy.currency,
        usedAmount: Number(usage.used),
        reservedAmount: Number(usage.reserved),
        remainingAmount: Math.max(
          0,
          Number((Number(policy.monthlyBudgetUsd) - Number(usage.used) - Number(usage.reserved)).toFixed(4)),
        ),
        currencySymbol: getCurrencyMetadata(policy.currency).symbol,
        hardStop: policy.hardStop === 'true',
        updatedAt: policy.updatedAt.toISOString(),
      };
    });
  },

  async save(team: string, input: { monthlyBudget: number; currency: string; hardStop: boolean }): Promise<void> {
    const limit = amount(input.monthlyBudget);
    if (Number(limit) !== input.monthlyBudget) throw new BudgetError('Budget supports at most four decimal places');
    await fxEngine.syncRatesFromRedis();
    const currency = input.currency.toUpperCase();
    if (!isSupportedCurrency(currency) || typeof input.hardStop !== 'boolean' || !team.trim())
      throw new BudgetError('Invalid budget policy');
    await db.transaction(async (tx) => {
      await lockTeam(tx, team);
      const [owner] = await tx.select().from(teamOwners).where(eq(teamOwners.team, team));
      if (!owner) throw new BudgetError('Team is not registered');
      const policy = await policyFor(tx, team);
      if (policy && policy.currency !== currency) {
        const usage = await tx.select().from(budgetUsage).where(eq(budgetUsage.policyId, policy.id)).limit(1);
        const holds = await tx
          .select()
          .from(budgetReservations)
          .where(eq(budgetReservations.policyId, policy.id))
          .limit(1);
        if (usage.length || holds.length) throw new BudgetError('Cannot change currency after accounting has started');
      }
      const fields = { monthlyBudgetUsd: limit, currency, hardStop: String(input.hardStop), updatedAt: new Date() };
      if (policy) await tx.update(budgetPolicies).set(fields).where(eq(budgetPolicies.id, policy.id));
      else {
        const now = new Date();
        const month = getUtcMonthString(now);
        const [pending] = await tx
          .select()
          .from(budgetReservations)
          .where(
            and(
              eq(budgetReservations.team, team),
              eq(budgetReservations.month, month),
              eq(budgetReservations.state, 'reserved'),
            ),
          )
          .limit(1);
        if (pending) throw new BudgetError('Reconcile pending sends before creating the first budget policy');
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
        const [spent] = await tx
          .select({ amount: sql<string>`coalesce(sum(${budgetLedger.amountUsd}), 0)::text` })
          .from(budgetLedger)
          .where(and(eq(budgetLedger.team, team), gte(budgetLedger.createdAt, start), lt(budgetLedger.createdAt, end)));
        const baseline = estimatedAmount(fxEngine.convert(Number(spent.amount), 'USD', currency, 8).convertedAmount);
        const id = generateMessageId();
        await tx.insert(budgetPolicies).values({ id, team, ...fields });
        if (units(baseline) > 0n)
          await tx
            .insert(budgetUsage)
            .values({ id: `${id}_${month}`, policyId: id, month, currency, usedUsd: baseline });
      }
    });
  },
};
