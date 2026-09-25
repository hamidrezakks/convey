import { NormalizedStatus } from './provider-types';

export function receiptStatus(
  payload: unknown,
  path = 'status',
  mapping: Record<string, NormalizedStatus> = {
    delivered: NormalizedStatus.DELIVERED,
    failed: NormalizedStatus.FAILED,
    undelivered: NormalizedStatus.FAILED,
    bounced: NormalizedStatus.BOUNCED,
    opened: NormalizedStatus.OPENED,
    read: NormalizedStatus.READ,
  },
): NormalizedStatus | undefined {
  let value: unknown = payload;
  for (const key of path.split('.')) {
    if (!value || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return typeof value === 'string' ? mapping[value.toLowerCase()] : undefined;
}
