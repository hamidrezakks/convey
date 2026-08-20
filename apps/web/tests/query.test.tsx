import './setup';
import { describe, expect, it } from 'bun:test';
import { queryClient } from '../src/lib/queryClient';
import { messageKeys, policyKeys, providerKeys, suppressionKeys, telemetryKeys } from '../src/lib/queryKeys';

describe('TanStack Query Configuration & Keys Test Suite', () => {
  it('instantiates QueryClient with tuned production defaults', () => {
    const defaultOptions = queryClient.getDefaultOptions();
    expect(defaultOptions.queries?.staleTime).toBe(5000);
    expect(defaultOptions.queries?.retry).toBe(2);
    expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(false);
  });

  it('generates structured type-safe query keys', () => {
    expect(telemetryKeys.overview()).toEqual(['telemetry', 'overview']);
    expect(telemetryKeys.live()).toEqual(['telemetry', 'live']);

    expect(messageKeys.list({ page: 1, limit: 15 })).toEqual(['messages', 'list', { page: 1, limit: 15 }]);

    expect(messageKeys.detail('msg_01JAX123')).toEqual(['messages', 'detail', 'msg_01JAX123']);

    expect(providerKeys.all).toEqual(['providers']);
    expect(suppressionKeys.list('test@domain.com')).toEqual(['suppressions', 'list', { search: 'test@domain.com' }]);
    expect(policyKeys.all).toEqual(['policies']);
  });
});
