import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class TwilioMockHandler implements ProviderMockHandler {
  readonly id = 'twilio';
  readonly channel = 'sms' as const;
  readonly defaultPort = 4002;

  matchesRequest(_req: Request, url: URL): boolean {
    return (
      url.hostname.includes('twilio.com') ||
      url.pathname.includes('/Messages.json') ||
      url.pathname.includes('/Accounts')
    );
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const authHeader = req.headers.get('authorization') || '';
    let accountSid = '';

    if (authHeader.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
        accountSid = decoded.split(':')[0] || '';
      } catch {
        // invalid base64
      }
    }

    const url = new URL(req.url);
    const urlMatch = url.pathname.match(/\/Accounts\/([^/]+)/);
    const pathAccountSid = urlMatch ? urlMatch[1] : '';

    if (!accountSid && pathAccountSid) {
      accountSid = pathAccountSid;
    }

    // Official Twilio validation: Account SID must begin with AC and have valid format
    if (!accountSid.startsWith('AC')) {
      const latencyMs = performance.now() - start;
      mockLogger.logRequest({
        providerId: this.id,
        method: req.method,
        url: url.pathname,
        status: 401,
        latencyMs,
        auth: 'Invalid Account SID format',
        error: "Authentication Error: Account SID must begin with 'AC'",
      });

      return new Response(
        JSON.stringify({
          code: 20003,
          message: 'Authentication Error: Account SID is invalid',
          more_info: 'https://www.twilio.com/docs/errors/20003',
          status: 401,
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    let to = '';
    let from = '';
    let bodyText = '';

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formText = await req.text();
      const params = new URLSearchParams(formText);
      to = params.get('To') || '';
      from = params.get('From') || '';
      bodyText = params.get('Body') || '';
    } else {
      try {
        const json = (await req.json()) as { To?: string; From?: string; Body?: string };
        to = json.To || '';
        from = json.From || '';
        bodyText = json.Body || '';
      } catch {
        // fallback
      }
    }

    const sid = generateProviderId(this.id);
    const latencyMs = performance.now() - start;

    mockLogger.logRequest({
      providerId: this.id,
      method: req.method,
      url: url.pathname,
      status: 201,
      latencyMs,
      auth: `Basic ${accountSid}:•••••••• (Valid Account SID)`,
      recipient: to,
      from,
      messageId: sid,
      payloadSummary: `Body: "${bodyText.slice(0, 40)}${bodyText.length > 40 ? '...' : ''}"`,
      action: "Scheduled async 'delivered' DLR callback in 400ms",
    });

    const now = new Date().toUTCString();
    return new Response(
      JSON.stringify({
        sid,
        date_created: now,
        date_updated: now,
        date_sent: null,
        account_sid: accountSid,
        to,
        from,
        messaging_service_sid: null,
        body: bodyText,
        status: 'queued',
        num_segments: '1',
        num_media: '0',
        direction: 'outbound-api',
        api_version: '2010-04-01',
        price: null,
        price_unit: 'USD',
        error_code: null,
        error_message: null,
        uri: `/2010-04-01/Accounts/${accountSid}/Messages/${sid}.json`,
      }),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'x-ratelimit-limit': '1000',
          'x-ratelimit-remaining': '999',
        },
      },
    );
  }
}

export const twilioMockHandler = new TwilioMockHandler();
