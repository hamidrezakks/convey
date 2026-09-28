import { observeProviderResponse } from '../../../utils/provider-retry-context';
import { ErrorCategory } from './provider-types';

/** Queue workers own retries; adapters must keep network/body waits bounded. */
export function providerFetch(input: string | URL | Request, init: RequestInit = {}): Promise<Response> {
  const timeout = AbortSignal.timeout(15_000);
  return globalThis
    .fetch(input, {
      ...init,
      redirect: 'error',
      signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
    })
    .then(observeProviderResponse);
}

export function httpErrorCategory(status: number): ErrorCategory {
  if (status === 429) return ErrorCategory.RATE_LIMITED;
  if (status === 408 || status >= 500) return ErrorCategory.TRANSIENT;
  return ErrorCategory.PERMANENT;
}
