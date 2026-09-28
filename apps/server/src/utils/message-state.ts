/** Success evidence is monotonic; a delayed failure cannot undo delivery or engagement. */
export function resolveMonotonicState(current: string, next: string): string {
  if (current === 'cancelled' || current === 'expired') return current;
  const success: Record<string, number> = { delivered: 1, opened: 2, read: 3 };
  if (success[current]) return (success[next] || 0) > success[current] ? next : current;
  if (success[next]) return next;
  if (current === 'failed' || current === 'bounced') return current;
  const progress: Record<string, number> = {
    pending: 0,
    queued: 0,
    accepted: 0,
    scheduled: 0,
    sending: 1,
    dispatched: 2,
    provider_accepted: 2,
  };
  if (next === 'failed' || next === 'bounced') return next;
  return next in progress && progress[next] >= (progress[current] ?? -1) ? next : current;
}
