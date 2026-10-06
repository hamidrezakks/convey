import { expect, test } from 'bun:test';
import { reconcileEvidence } from './reconciliation';

const row = {
  executionId: 'mock-execution',
  team: 'mock-team',
  currency: 'USD',
  estimate: '0.0100',
  observed: '0.0125',
};
test('mock billing comparison preserves exact amounts and fails unexplained differences', () => {
  expect(reconcileEvidence([row])[0]).toMatchObject({ variance: '0.0025', status: 'unexplained' });
  expect(reconcileEvidence([{ ...row, explanation: 'Mock carrier surcharge' }])[0].status).toBe('explained');
  expect(reconcileEvidence([{ ...row, observed: '0.0100' }])[0].status).toBe('matched');
  expect(reconcileEvidence([{ ...row, observed: '0' }])[0].variance).toBe('-0.0100');
  expect(() => reconcileEvidence([row, row])).toThrow('Duplicate');
  expect(reconcileEvidence([row, { ...row, team: 'other-team' }])).toHaveLength(2);
  for (const estimate of ['NaN', '-1', '0.00001', '1e3'])
    expect(() => reconcileEvidence([{ ...row, estimate }])).toThrow();
  expect(row.estimate).toBe('0.0100');
});
