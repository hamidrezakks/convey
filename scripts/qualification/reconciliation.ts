export interface BillingEvidence {
  executionId: string;
  team: string;
  currency: string;
  estimate: string;
  observed: string;
  explanation?: string;
}
function units(value: string): bigint {
  if (typeof value !== 'string' || !/^\d{1,8}(\.\d{1,4})?$/.test(value))
    throw new Error('Expected a nonnegative four-decimal amount');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
}
function amount(value: bigint) {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${absolute / 10000n}.${String(absolute % 10000n).padStart(4, '0')}`;
}
/** Compare same-currency evidence without altering the budget ledger or inventing FX. */
export function reconcileEvidence(rows: BillingEvidence[]) {
  const seen = new Set<string>();
  return rows.map((row) => {
    if (!row.executionId || !row.team || !/^[A-Z]{3}$/.test(row.currency))
      throw new Error('Evidence identity and currency required');
    const id = JSON.stringify([row.team, row.executionId]);
    if (seen.has(id)) throw new Error('Duplicate execution evidence');
    seen.add(id);
    const variance = units(row.observed) - units(row.estimate);
    return {
      ...row,
      variance: amount(variance),
      status: variance === 0n ? 'matched' : row.explanation?.trim() ? 'explained' : 'unexplained',
    };
  });
}
if (import.meta.main) {
  const file = process.argv[2];
  if (!file) throw new Error('Pass a same-currency evidence JSON file; this command never changes accounting');
  const rows = reconcileEvidence(await Bun.file(file).json());
  console.log(JSON.stringify({ rows, accountingModified: false }, null, 2));
  if (rows.some((row) => row.status === 'unexplained')) process.exitCode = 1;
}
