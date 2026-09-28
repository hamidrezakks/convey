import { expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { db } from '../src/db';
import { BudgetService } from '../src/modules/policies/budget.service';
import { validateProviderPrice } from '../src/modules/policies/provider-pricing';
import { generateMessageId } from '../src/utils/id';

test('reconciliation enforces team scope and atomically records a single audit', async () => {
  const team = `reconcile_${crypto.randomUUID()}`;
  const hold = await BudgetService.reserve(
    {
      key: 'one',
      team,
      amount: 0.5,
      messageId: generateMessageId(),
      channel: 'sms',
      providerId: 'test',
      currency: 'USD',
    },
    new Date(Date.now() - 7200_000),
  );
  expect(hold.allowed).toBe(true);
  expect((await BudgetService.listHolds(team))[0].stale).toBe(true);
  await expect(
    BudgetService.settle(hold.id, 'released', {
      team: 'wrong-team',
      actorId: 'operator',
      reason: 'Provider confirmed no charge',
    }),
  ).rejects.toThrow('Unknown');
  await expect(
    BudgetService.settle(hold.id, 'released', { team, actorId: 'operator', reason: 'short' }),
  ).rejects.toThrow('evidence');
  const audit = { team, actorId: 'operator', reason: 'Provider confirmed no charge' };
  await Promise.all([
    BudgetService.settle(hold.id, 'released', audit),
    BudgetService.settle(hold.id, 'released', audit),
  ]);
  expect(await BudgetService.listHolds(team)).toHaveLength(0);
  const rows = await db.execute(sql`SELECT * FROM budget_reconciliations WHERE reservation_id = ${hold.id}`);
  expect(rows).toHaveLength(1);
  expect(rows[0].actor_id).toBe('operator');
  await expect(BudgetService.settle(hold.id, 'committed', audit)).rejects.toThrow('already settled differently');
  await db.execute(sql`DELETE FROM budget_reconciliations WHERE reservation_id = ${hold.id}`);
  await db.execute(sql`DELETE FROM budget_reservations WHERE id = ${hold.id}`);
});

test('configured prices reject invalid and unknown-currency amounts', () => {
  for (const price of [
    { cost: NaN, currency: 'USD' },
    { cost: -1, currency: 'USD' },
    { cost: 0.2, currency: 'ZZZ' },
    null,
  ])
    expect(() => validateProviderPrice(price)).toThrow();
  expect(validateProviderPrice({ cost: 0.025, currency: 'aed' })).toEqual({ cost: 0.025, currency: 'AED' });
});
