import dns from 'node:dns/promises';
import { logger } from '../../../../utils/logger';
import { observeProviderResponse } from '../../../../utils/provider-retry-context';
import { ErrorCategory } from '../provider-types';
import { createHttpProxyFetch } from './http-proxy-tunnel';
import { isProxyBypassed } from './proxy-matcher';
import type { ProviderProxyConfig, ProxyDiagnosticResult } from './proxy-types';
import { createSocks5Fetch } from './socks5-tunnel';

/**
 * Creates a drop-in high-performance fetch function bound to the given proxy configuration.
 * Automatically falls back to native direct fetch if proxy is disabled or destination is in noProxy.
 */
export function createTransportFetch(proxyConfig?: ProviderProxyConfig): typeof globalThis.fetch {
  const transport = createRawTransportFetch(proxyConfig);
  const observed = async (input: string | URL | Request, init?: RequestInit) =>
    observeProviderResponse(await transport(input, init));
  return observed as typeof globalThis.fetch;
}

function createRawTransportFetch(proxyConfig?: ProviderProxyConfig): typeof globalThis.fetch {
  if (!proxyConfig?.enabled || !proxyConfig?.host) {
    return globalThis.fetch;
  }

  const customFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const targetUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Check if target URL matches noProxy bypass rules
    if (isProxyBypassed(targetUrl, proxyConfig.noProxy)) {
      return globalThis.fetch(input, init);
    }

    const type = (proxyConfig.type || 'http').toLowerCase();

    if (type === 'socks5' || type === 'socks5h') {
      return createSocks5Fetch(proxyConfig)(input, init);
    }

    if (type === 'http' || type === 'https') {
      return createHttpProxyFetch(proxyConfig)(input, init);
    }

    return globalThis.fetch(input, init);
  };

  return customFetch as unknown as typeof globalThis.fetch;
}

/**
 * Executes a resilient provider HTTP request using the configured transport proxy.
 * Maps network and socket errors into normalized error categories (TRANSIENT vs PERMANENT).
 */
export async function executeProviderRequest(
  url: string,
  init: RequestInit = {},
  proxyConfig?: ProviderProxyConfig,
): Promise<{
  ok: boolean;
  status: number;
  data: unknown;
  rawText: string;
  errorCategory?: ErrorCategory;
  errorMessage?: string;
}> {
  const fetchFn = createTransportFetch(proxyConfig);
  const timeoutMs = proxyConfig?.timeoutMs ?? 15_000;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  if (init.signal) {
    init.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetchFn(url, {
      ...init,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const rawText = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }

    if (!response.ok) {
      let category = ErrorCategory.TRANSIENT;
      if (
        response.status === 400 ||
        response.status === 401 ||
        response.status === 403 ||
        response.status === 404 ||
        response.status === 422
      ) {
        category = ErrorCategory.PERMANENT;
      } else if (response.status === 429) {
        category = ErrorCategory.RATE_LIMITED;
      }

      return {
        ok: false,
        status: response.status,
        data,
        rawText,
        errorCategory: category,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return {
      ok: true,
      status: response.status,
      data,
      rawText,
    };
  } catch (err: unknown) {
    clearTimeout(timeout);
    const error = err as Error;
    const isAbort = error.name === 'AbortError' || error.message.includes('aborted');

    logger.warn(
      'TransportClient',
      `Outbound request failed via proxy [${proxyConfig?.type || 'direct'}]: ${error.message}`,
    );

    return {
      ok: false,
      status: isAbort ? 504 : 502,
      data: null,
      rawText: '',
      errorCategory: ErrorCategory.TRANSIENT,
      errorMessage: error.message,
    };
  }
}

/**
 * Diagnostic tool to probe and verify connectivity of a configured proxy server.
 */
export async function testProxyConnectivity(
  proxyConfig: ProviderProxyConfig,
  targetTestUrl = 'https://api.resend.com/emails',
): Promise<ProxyDiagnosticResult> {
  const startTime = performance.now();
  let dnsLatencyMs: number | undefined;
  let resolvedIp: string | undefined;

  // 1. DNS Resolution Probe
  try {
    const dnsStart = performance.now();
    const lookup = await dns.lookup(proxyConfig.host);
    dnsLatencyMs = Math.round((performance.now() - dnsStart) * 100) / 100;
    resolvedIp = lookup.address;
  } catch (err: unknown) {
    return {
      success: false,
      proxyType: proxyConfig.type,
      proxyHost: proxyConfig.host,
      proxyPort: proxyConfig.port,
      handshakeLatencyMs: 0,
      e2eLatencyMs: Math.round(performance.now() - startTime),
      error: `Proxy DNS lookup failed for ${proxyConfig.host}: ${(err as Error).message}`,
      timestamp: new Date().toISOString(),
    };
  }

  // 2. Handshake & Target Connection Probe
  try {
    const transportFetch = createTransportFetch(proxyConfig);
    const probeStart = performance.now();

    const response = await transportFetch(targetTestUrl, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': 'Convey-Proxy-Probe/1.0' },
      signal: AbortSignal.timeout(proxyConfig.timeoutMs || 8_000),
    });

    const e2eLatencyMs = Math.round(performance.now() - startTime);
    const handshakeLatencyMs = Math.round(performance.now() - probeStart);

    return {
      success: true,
      proxyType: proxyConfig.type,
      proxyHost: proxyConfig.host,
      proxyPort: proxyConfig.port,
      resolvedIp,
      dnsLatencyMs,
      handshakeLatencyMs,
      e2eLatencyMs,
      statusCode: response.status,
      message: `Successfully connected through ${proxyConfig.type.toUpperCase()} proxy (${proxyConfig.host}:${proxyConfig.port}) in ${e2eLatencyMs}ms`,
      timestamp: new Date().toISOString(),
    };
  } catch (err: unknown) {
    const e2eLatencyMs = Math.round(performance.now() - startTime);
    return {
      success: false,
      proxyType: proxyConfig.type,
      proxyHost: proxyConfig.host,
      proxyPort: proxyConfig.port,
      resolvedIp,
      dnsLatencyMs,
      handshakeLatencyMs: 0,
      e2eLatencyMs,
      error: `Proxy connection probe failed: ${(err as Error).message}`,
      timestamp: new Date().toISOString(),
    };
  }
}
