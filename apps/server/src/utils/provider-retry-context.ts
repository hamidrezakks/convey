import { AsyncLocalStorage } from 'node:async_hooks';
import { parseRetryAfter } from './provider-retry';

const context = new AsyncLocalStorage<{ retryAfterMs?: number }>();
export async function captureProviderRetryAfter<T>(send: () => Promise<T>) {
  const state: { retryAfterMs?: number } = {};
  const result = await context.run(state, send);
  return { result, retryAfterMs: state.retryAfterMs };
}
export function observeProviderResponse(response: Response): Response {
  const state = context.getStore();
  if (state && response.status === 429) {
    const hint = parseRetryAfter(response.headers.get('retry-after'));
    if (hint) state.retryAfterMs = Math.max(state.retryAfterMs || 0, hint);
  }
  return response;
}
