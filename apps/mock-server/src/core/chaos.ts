import { mockConfig } from '../config';

export interface ChaosCheckParams {
  headers: Headers;
}

export interface ChaosResult {
  shouldHalt: boolean;
  status: number;
  responseBody?: unknown;
  latencyMs?: number;
}

export function applyChaosSimulation({ headers }: ChaosCheckParams): ChaosResult {
  // 1. Check for header-based status code overrides
  const forcedStatus = headers.get('x-mock-status');
  if (forcedStatus) {
    const status = Number.parseInt(forcedStatus, 10);
    if (!Number.isNaN(status) && status >= 400) {
      return {
        shouldHalt: true,
        status,
        responseBody: {
          error: {
            code: status === 429 ? 'RATE_LIMIT_EXCEEDED' : 'CHAOS_ERROR',
            message: `Simulated error response with HTTP status ${status}`,
          },
        },
      };
    }
  }

  // 2. Check for forced generic error
  const forcedError = headers.get('x-mock-error');
  if (forcedError === 'true') {
    return {
      shouldHalt: true,
      status: 500,
      responseBody: {
        error: {
          code: 'INTERNAL_PROVIDER_ERROR',
          message: 'Simulated internal provider server failure',
        },
      },
    };
  }

  // 3. Check for forced latency
  const forcedLatency = headers.get('x-mock-latency');
  const latencyMs = forcedLatency ? Number.parseInt(forcedLatency, 10) : mockConfig.chaosLatencyMs;

  // 4. Random error rate simulation
  if (mockConfig.chaosErrorRate > 0 && Math.random() < mockConfig.chaosErrorRate) {
    return {
      shouldHalt: true,
      status: 429,
      responseBody: {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, simulated throttle triggered',
        },
      },
      latencyMs,
    };
  }

  return {
    shouldHalt: false,
    status: 200,
    latencyMs,
  };
}
