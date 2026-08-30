import { mockConfig } from '../config';
import { chatHandlers, findChatHandler } from '../handlers/chat';
import { emailHandlers, findEmailHandler } from '../handlers/email';
import { findPushHandler, pushHandlers } from '../handlers/push';
import { findSmsHandler, smsHandlers } from '../handlers/sms';
import { findToolHandler, toolHandlers } from '../handlers/tool';
import { applyChaosSimulation } from './chaos';
import { generateProviderId } from './id-generator';
import { mockLogger } from './logger';
import type { ProviderMockHandler, RecordedRequest } from './types';
import { scheduleWebhookCallback } from './webhook-client';

export const recordedRequests: RecordedRequest[] = [];
const MAX_RECORDED_REQUESTS = 500;

export const allHandlers: Record<string, ProviderMockHandler> = {
  ...emailHandlers,
  ...smsHandlers,
  ...chatHandlers,
  ...pushHandlers,
  ...toolHandlers,
};

export function findHandlerForRequest(req: Request, url: URL): ProviderMockHandler | undefined {
  // If running in dedicated discrete provider container mode
  if (mockConfig.providerId !== 'all') {
    const handler = allHandlers[mockConfig.providerId];
    if (handler) return handler;
  }

  // Universal gateway search
  return (
    findEmailHandler(req, url) ||
    findSmsHandler(req, url) ||
    findChatHandler(req, url) ||
    findPushHandler(req, url) ||
    findToolHandler(req, url)
  );
}

export async function dispatchMockRequest(req: Request): Promise<Response> {
  const start = performance.now();
  const url = new URL(req.url);

  // 1. Healthcheck & Inspection endpoints
  if (url.pathname === '/health' || url.pathname === '/health/liveness' || url.pathname === '/health/readiness') {
    return new Response(
      JSON.stringify({
        status: 'ok',
        providerId: mockConfig.providerId,
        uptime: process.uptime(),
        recordedRequestsCount: recordedRequests.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (url.pathname === '/__inspect/requests' && req.method === 'GET') {
    return new Response(JSON.stringify(recordedRequests), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.pathname === '/__inspect/requests' && req.method === 'DELETE') {
    recordedRequests.length = 0;
    return new Response(JSON.stringify({ cleared: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Apply Chaos Engine (Latency & Fault Injection)
  const chaos = applyChaosSimulation({ headers: req.headers });
  if (chaos.latencyMs && chaos.latencyMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, chaos.latencyMs));
  }

  if (chaos.shouldHalt) {
    const latencyMs = performance.now() - start;
    mockLogger.logRequest({
      providerId: mockConfig.providerId,
      method: req.method,
      url: url.pathname,
      status: chaos.status,
      latencyMs,
      error: `Chaos Fault Triggered: HTTP ${chaos.status}`,
    });

    return new Response(JSON.stringify(chaos.responseBody || { error: 'Chaos Fault' }), {
      status: chaos.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. Match Handler
  const handler = findHandlerForRequest(req, url);

  if (!handler) {
    const fallbackId = generateProviderId('generic');
    const latencyMs = performance.now() - start;

    mockLogger.logRequest({
      providerId: mockConfig.providerId || 'generic',
      method: req.method,
      url: url.pathname,
      status: 200,
      latencyMs,
      messageId: fallbackId,
      payloadSummary: 'Fallback catch-all handler',
    });

    const res = new Response(
      JSON.stringify({
        status: 'success',
        id: fallbackId,
        message: 'Mock fallback processed',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    recordRequestHistory({
      req,
      url,
      providerId: mockConfig.providerId || 'generic',
      channel: 'email',
      status: 200,
      responseBody: { id: fallbackId },
      durationMs: latencyMs,
    });

    return res;
  }

  // 4. Clone request to safely inspect body & headers
  const reqClone = req.clone();
  let rawBodyText = '';
  let parsedBody: unknown = {};
  try {
    rawBodyText = await reqClone.text();
    parsedBody = JSON.parse(rawBodyText);
  } catch {
    parsedBody = rawBodyText;
  }

  // 5. Execute Provider Handler
  const response = await handler.handle(req, {
    providerId: handler.id,
    channel: handler.channel,
    url,
    method: req.method,
    headers: req.headers,
    rawBody: rawBodyText,
    parsedBody,
    receivedAt: new Date(),
  });

  const durationMs = performance.now() - start;

  // 6. Record for Live Inspection
  let responseData: unknown;
  try {
    const resClone = response.clone();
    responseData = await resClone.json();
  } catch {
    responseData = null;
  }

  recordRequestHistory({
    req,
    url,
    providerId: handler.id,
    channel: handler.channel,
    status: response.status,
    responseBody: responseData,
    durationMs,
    parsedBody,
  });

  // 7. Trigger async webhook callback if response succeeded
  if (response.status >= 200 && response.status < 300) {
    const messageId =
      (responseData as { id?: string; MessageId?: string; sid?: string; messageId?: string })?.id ||
      (responseData as { MessageId?: string })?.MessageId ||
      (responseData as { sid?: string })?.sid ||
      (responseData as { messageId?: string })?.messageId ||
      generateProviderId(handler.id);

    let recipient = 'user@example.com';
    if (typeof parsedBody === 'object' && parsedBody !== null) {
      const p = parsedBody as Record<string, unknown>;
      recipient = String(p.to || p.recipient || p.To || p.dst || 'user@example.com');
    }

    let eventType: 'delivered' | 'bounced' | 'failed' = 'delivered';
    if (recipient.includes('bounce')) {
      eventType = 'bounced';
    } else if (recipient.includes('fail')) {
      eventType = 'failed';
    }

    scheduleWebhookCallback(handler.id, {
      eventType,
      messageId,
      recipient,
    });
  }

  return response;
}

function recordRequestHistory(params: {
  req: Request;
  url: URL;
  providerId: string;
  channel: string;
  status: number;
  responseBody: unknown;
  durationMs: number;
  parsedBody?: unknown;
}): void {
  const headersObj: Record<string, string> = {};
  for (const [key, val] of params.req.headers.entries()) {
    headersObj[key] = val;
  }

  recordedRequests.push({
    id: generateProviderId('req'),
    providerId: params.providerId,
    channel: params.channel as RecordedRequest['channel'],
    method: params.req.method,
    url: params.url.toString(),
    headers: headersObj,
    body: params.parsedBody || {},
    status: params.status,
    responseBody: params.responseBody,
    timestamp: new Date().toISOString(),
    durationMs: params.durationMs,
  });

  if (recordedRequests.length > MAX_RECORDED_REQUESTS) {
    recordedRequests.shift();
  }
}
