import { ProviderRegistry } from '../../src/modules/providers/core/provider-registry';

export interface MockedRequestRecord {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  providerId: string;
  outcome: 'success' | 'failure';
  statusCode: number;
  providerMessageId?: string;
  timestamp: string;
}

export interface MockStats {
  totalRequests: number;
  successes: number;
  failures: number;
  failureRatePercent: number;
  requestsByProvider: Record<string, number>;
}

let originalFetch: typeof globalThis.fetch | null = null;
let isMockEnabled = false;
let customFailureRate = 0.1; // 10% failure rate by default
const recordedRequests: MockedRequestRecord[] = [];
let reqCounter = 0;

// Deterministic seed / counter based failure generator for consistent 10% failure distribution
function shouldFail(requestIndex: number): boolean {
  if (customFailureRate <= 0) return false;
  if (customFailureRate >= 1) return true;

  // Pattern-based 1 out of 10 failure (e.g. index 7, 17, 27...) to guarantee exact 10%
  const moduloTarget = Math.round(1 / customFailureRate);
  return requestIndex % moduloTarget === 7;
}

function detectProviderFromUrl(url: string, method = 'POST'): string {
  const registeredMock = ProviderRegistry.findMock(url, method);
  if (registeredMock) {
    return registeredMock.providerId;
  }

  const lower = url.toLowerCase();
  // Email
  if (lower.includes('sendgrid.com')) return 'sendgrid';
  if (lower.includes('resend.com')) return 'resend';
  if (lower.includes('postmarkapp.com')) return 'postmark';
  if (lower.includes('sparkpost.com')) return 'sparkpost';
  if (lower.includes('mailtrap.io')) return 'mailtrap';
  if (lower.includes('mailersend.com')) return 'mailersend';
  if (lower.includes('mailgun.net') || lower.includes('mailgun.com')) return 'mailgun';
  if (lower.includes('brevo.com') || lower.includes('sendinblue.com')) return 'brevo';
  if (lower.includes('mandrillapp.com')) return 'mandrill';
  if (lower.includes('plunk.dev')) return 'plunk';

  // SMS & Multi-channel
  if (lower.includes('twilio.com')) return 'twilio';
  if (lower.includes('cequens.com')) return 'cequens';
  if (lower.includes('bulksms.com')) return 'bulk-sms';
  if (lower.includes('plivo.com')) return 'plivo';
  if (lower.includes('nexmo.com') || lower.includes('vonage.com')) return 'nexmo';
  if (lower.includes('sinch.com')) return 'sinch';
  if (lower.includes('bandwidth.com')) return 'bandwidth';
  if (lower.includes('messagebird.com')) return 'messagebird';
  if (lower.includes('termii.com')) return 'termii';
  if (lower.includes('clicksend.com')) return 'clicksend';
  if (lower.includes('46elks.com')) return 'forty-six-elks';
  if (lower.includes('africastalking.com')) return 'africas-talking';
  if (lower.includes('gupshup.io')) return 'gupshup';
  if (lower.includes('unifonic.com')) return 'unifonic';
  if (lower.includes('sms77.io')) return 'sms77';
  if (lower.includes('infobip.com')) return 'infobip';
  if (lower.includes('amazonaws.com')) return 'sns';

  // Push
  if (lower.includes('googleapis.com') || lower.includes('fcm')) return 'fcm';
  if (lower.includes('push.apple.com') || lower.includes('apns')) return 'apns';
  if (lower.includes('onesignal.com')) return 'one-signal';
  if (lower.includes('expo.dev') || lower.includes('expo.io')) return 'expo';
  if (lower.includes('pushpad.xyz')) return 'pushpad';
  if (lower.includes('pusher.com')) return 'pusher-beams';

  // Chat
  if (lower.includes('slack.com')) return 'slack';
  if (lower.includes('telegram.org')) return 'telegram';
  if (lower.includes('discord.com')) return 'discord';
  if (lower.includes('mattermost.com')) return 'mattermost';
  if (lower.includes('zulipchat.com')) return 'zulip';
  if (lower.includes('line.me')) return 'line';
  if (lower.includes('webex.com')) return 'webex-messaging';
  if (lower.includes('rocket.chat')) return 'rocket-chat';
  if (lower.includes('webhook.office.com') || lower.includes('msteams')) return 'msTeams';
  if (lower.includes('stream-io-api.com')) return 'getstream';
  if (lower.includes('grafana.net') || lower.includes('oncall')) return 'grafana-on-call';
  if (lower.includes('ryver.com')) return 'ryver';
  if (lower.includes('sendblue.co')) return 'sendblue';
  if (lower.includes('chat-webhook')) return 'chat-webhook';
  if (lower.includes('graph.facebook.com')) return 'whatsapp-business';

  // Tools & Monitoring
  if (lower.includes('opsgenie.com')) return 'opsgenie';
  if (lower.includes('pagerduty.com')) return 'pagerduty';
  if (lower.includes('grafana.com')) return 'grafana';

  return 'generic';
}

function generateProviderMessageId(providerId: string): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `${providerId}_msg_${timestamp}_${randomStr}`;
}

export function enableProviderMock(failureRate = 0.1) {
  if (isMockEnabled) return;

  customFailureRate = failureRate;
  originalFetch = globalThis.fetch;
  isMockEnabled = true;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const method =
      init?.method || (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET') || 'GET';

    // Only intercept external 3rd-party provider API calls (not internal localhost API calls)
    const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
    if (isLocalhost) {
      return originalFetch ? originalFetch(input, init) : fetch(input, init);
    }

    reqCounter++;
    const providerId = detectProviderFromUrl(url);
    const failThisCall = shouldFail(reqCounter);

    let parsedBody: unknown = null;
    if (init?.body) {
      try {
        parsedBody = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
      } catch {
        parsedBody = init.body;
      }
    }

    const headerMap: Record<string, string> = {};
    if (init?.headers) {
      const hdrs = init.headers as Record<string, string> | Headers;
      if ('forEach' in hdrs && typeof hdrs.forEach === 'function') {
        hdrs.forEach((v: string, k: string) => {
          headerMap[k.toLowerCase()] = v;
        });
      } else {
        for (const [k, v] of Object.entries(hdrs)) {
          headerMap[k.toLowerCase()] = String(v);
        }
      }
    }

    if (failThisCall) {
      const errorOptions = [
        { status: 429, body: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } } },
        { status: 500, body: { error: { code: 'INTERNAL_SERVER_ERROR', message: 'Provider internal error' } } },
        { status: 503, body: { error: { code: 'SERVICE_UNAVAILABLE', message: 'Provider service temporarily down' } } },
        { status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'Invalid API key or token' } } },
      ];
      const selectedErr = errorOptions[reqCounter % errorOptions.length];

      recordedRequests.push({
        id: `req_${reqCounter}`,
        url,
        method,
        headers: headerMap,
        body: parsedBody,
        providerId,
        outcome: 'failure',
        statusCode: selectedErr.status,
        timestamp: new Date().toISOString(),
      });

      return new Response(JSON.stringify(selectedErr.body), {
        status: selectedErr.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if co-located provider module defines its own mock
    const registeredMock = ProviderRegistry.findMock(url, method);
    const resolvedProviderId = registeredMock ? registeredMock.providerId : providerId;
    const providerMsgId = generateProviderMessageId(resolvedProviderId);

    const response = registeredMock
      ? registeredMock.mock.buildResponse({
          url,
          method,
          body: parsedBody,
          headers: headerMap,
          providerMessageId: providerMsgId,
        })
      : buildNativeProviderResponse(providerId, url, method, parsedBody, headerMap, providerMsgId);

    recordedRequests.push({
      id: `req_${reqCounter}`,
      url,
      method,
      headers: headerMap,
      body: parsedBody,
      providerId: resolvedProviderId,
      outcome: 'success',
      statusCode: response.status,
      providerMessageId: providerMsgId,
      timestamp: new Date().toISOString(),
    });

    return response;
  }) as typeof fetch;
}

function buildNativeProviderResponse(
  providerId: string,
  url: string,
  _method: string,
  body: unknown,
  _headerMap: Record<string, string>,
  providerMsgId: string,
): Response {
  if (providerId === 'sendgrid') {
    return new Response('', {
      status: 202,
      headers: {
        'x-message-id': providerMsgId,
        'content-type': 'application/json',
      },
    });
  }

  if (providerId === 'twilio') {
    let toPhone = '+971501234567';
    if (body && typeof (body as { get?: (k: string) => string | null }).get === 'function') {
      const val = (body as { get: (k: string) => string | null }).get('To');
      if (val) toPhone = val.replace(/\s+/g, '+');
    } else if (typeof body === 'string') {
      const params = new URLSearchParams(body);
      const val = params.get('To');
      if (val) toPhone = val.replace(/\s+/g, '+');
    } else if (body && typeof body === 'object' && 'To' in (body as Record<string, unknown>)) {
      toPhone = String((body as Record<string, unknown>).To);
    }

    const isWhatsapp = url.includes('whatsapp') || toPhone.includes('whatsapp');
    const formattedTo = toPhone.startsWith('whatsapp:') ? toPhone : isWhatsapp ? `whatsapp:${toPhone}` : toPhone;

    return new Response(
      JSON.stringify({
        sid: providerMsgId,
        date_created: new Date().toUTCString(),
        date_updated: new Date().toUTCString(),
        account_sid: 'AC1234567890abcdef1234567890abcdef',
        to: formattedTo,
        from: isWhatsapp ? 'whatsapp:+14155238886' : '+14155238886',
        body: typeof body === 'string' ? body : 'Twilio message',
        status: 'queued',
        num_segments: '1',
        price: null,
        price_unit: 'USD',
        uri: `/2010-04-01/Accounts/AC12345/Messages/${providerMsgId}.json`,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (providerId === 'cequens') {
    return new Response(
      JSON.stringify({
        replyCode: 0,
        replyMessage: 'ACCEPTED',
        data: {
          messageId: providerMsgId,
          clientRef: 'client_ref_123',
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (providerId === 'resend') {
    return new Response(
      JSON.stringify({
        id: providerMsgId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (providerId === 'postmark') {
    return new Response(
      JSON.stringify({
        To: 'user@example.com',
        SubmittedAt: new Date().toISOString(),
        MessageID: providerMsgId,
        ErrorCode: 0,
        Message: 'OK',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (providerId === 'mailgun') {
    return new Response(
      JSON.stringify({
        id: `<${providerMsgId}@mailgun.org>`,
        message: 'Queued. Thank you.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (providerId === 'brevo') {
    return new Response(
      JSON.stringify({
        messageId: `<${providerMsgId}@brevo.com>`,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (providerId === 'plivo') {
    return new Response(
      JSON.stringify({
        message: 'message(s) queued',
        message_uuid: [providerMsgId],
        api_id: `plivo_api_${providerMsgId}`,
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (providerId === 'telnyx') {
    return new Response(
      JSON.stringify({
        data: {
          id: providerMsgId,
          record_type: 'message',
          direction: 'outbound',
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (providerId === 'sinch') {
    return new Response(
      JSON.stringify({
        id: providerMsgId,
        type: 'mt_text',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (providerId === 'infobip') {
    return new Response(
      JSON.stringify({
        messages: [
          {
            to: 'recipient',
            status: {
              groupId: 1,
              groupName: 'PENDING',
              id: 26,
              name: 'PENDING_ACCEPTED',
            },
            messageId: providerMsgId,
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (providerId === 'nexmo') {
    return new Response(
      JSON.stringify({
        'message-count': '1',
        messages: [
          {
            to: 'recipient',
            'message-id': providerMsgId,
            status: '0',
            'remaining-balance': '10.00',
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (providerId === 'fcm') {
    return new Response(
      JSON.stringify({
        name: `projects/my-project/messages/${providerMsgId}`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (providerId === 'apns') {
    return new Response('{}', {
      status: 200,
      headers: {
        'apns-id': providerMsgId,
        'content-type': 'application/json',
      },
    });
  }

  if (providerId === 'one-signal') {
    return new Response(
      JSON.stringify({
        id: providerMsgId,
        recipients: 1,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (providerId === 'slack') {
    return new Response(
      JSON.stringify({
        ok: true,
        channel: 'C123456',
        ts: '1786437416.000100',
        message: { text: 'Slack message', bot_id: 'B12345' },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (providerId === 'telegram') {
    return new Response(
      JSON.stringify({
        ok: true,
        result: {
          message_id: 998811,
          chat: { id: 123456, type: 'private' },
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (providerId === 'discord') {
    return new Response(
      JSON.stringify({
        id: providerMsgId,
        channel_id: '123456789',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (providerId === 'opsgenie') {
    return new Response(
      JSON.stringify({
        result: 'Request processed successfully',
        requestId: providerMsgId,
        took: 0.05,
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (providerId === 'pagerduty') {
    return new Response(
      JSON.stringify({
        status: 'success',
        message: 'Event processed',
        dedup_key: providerMsgId,
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (providerId === 'grafana') {
    return new Response(
      JSON.stringify({
        status: 'ok',
        alert_id: providerMsgId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  // Generic fallback structure
  return new Response(
    JSON.stringify({
      id: providerMsgId,
      status: 'queued',
      received: true,
      message_id: providerMsgId,
      sid: providerMsgId,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

export function disableProviderMock() {
  if (!isMockEnabled) return;
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
  isMockEnabled = false;
}

export function resetProviderMockStats() {
  recordedRequests.length = 0;
  reqCounter = 0;
}

export function getMockRecordedRequests(): MockedRequestRecord[] {
  return recordedRequests;
}

export function getMockStats(): MockStats {
  const totalRequests = recordedRequests.length;
  const successes = recordedRequests.filter((r) => r.outcome === 'success').length;
  const failures = recordedRequests.filter((r) => r.outcome === 'failure').length;
  const failureRatePercent = totalRequests > 0 ? Number(((failures / totalRequests) * 100).toFixed(2)) : 0;

  const requestsByProvider: Record<string, number> = {};
  for (const req of recordedRequests) {
    requestsByProvider[req.providerId] = (requestsByProvider[req.providerId] || 0) + 1;
  }

  return {
    totalRequests,
    successes,
    failures,
    failureRatePercent,
    requestsByProvider,
  };
}
