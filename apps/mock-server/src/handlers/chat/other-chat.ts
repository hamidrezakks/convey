import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class GenericChatMockHandler implements ProviderMockHandler {
  readonly id: string;
  readonly channel = 'chat' as const;
  readonly domains: string[];
  readonly paths: string[];

  constructor(id: string, domains: string[] = [], paths: string[] = []) {
    this.id = id;
    this.domains = [id, ...domains];
    this.paths = paths;
  }

  matchesRequest(_req: Request, url: URL): boolean {
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    return (
      this.domains.some((d) => host.includes(d.toLowerCase())) ||
      this.paths.some((p) => path === p || path.startsWith(`${p}/`)) ||
      path.includes(this.id)
    );
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const authHeader = req.headers.get('authorization') || '';
    const authDisplay = authHeader ? 'Chat Credentials (Valid)' : 'Webhook URL';

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      // empty
    }

    const recipient = String(body.channel || body.recipient || body.to || 'chat-channel');
    const messageId = generateProviderId(this.id);
    const latencyMs = performance.now() - start;

    mockLogger.logRequest({
      providerId: this.id,
      method: req.method,
      url: new URL(req.url).pathname,
      status: 200,
      latencyMs,
      auth: authDisplay,
      recipient,
      messageId,
      payloadSummary: `${JSON.stringify(body).length} bytes`,
      action: "Scheduled async 'delivered' callback in 400ms",
    });

    return new Response(
      JSON.stringify({
        ok: true,
        id: messageId,
        messageId,
        status: 'sent',
        provider: this.id,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export const otherChatHandlers: Record<string, ProviderMockHandler> = {
  msteams: new GenericChatMockHandler('msteams', ['webhook.office.com', 'teams.microsoft.com'], ['/teams/']),
  'twilio-whatsapp': new GenericChatMockHandler('twilio-whatsapp', ['api.twilio.com'], ['/Messages.json']),
  line: new GenericChatMockHandler('line', ['api.line.me'], ['/v2/bot/message/push']),
  zulip: new GenericChatMockHandler('zulip', ['zulipchat.com'], ['/api/v1/messages']),
  'rocket-chat': new GenericChatMockHandler('rocket-chat', ['rocket.chat'], ['/api/v1/chat.postMessage']),
  mattermost: new GenericChatMockHandler('mattermost', ['mattermost'], ['/api/v4/posts']),
  getstream: new GenericChatMockHandler('getstream', ['stream-io-api.com'], ['/message']),
  'webex-messaging': new GenericChatMockHandler('webex-messaging', ['webexapis.com'], ['/v1/messages']),
  'grafana-on-call': new GenericChatMockHandler('grafana-on-call', ['grafana.net'], ['/oncall']),
  sendblue: new GenericChatMockHandler('sendblue', ['sendblue.co'], ['/api/send-message']),
  ryver: new GenericChatMockHandler('ryver', ['ryver.com'], ['/item']),
  'chat-webhook': new GenericChatMockHandler('chat-webhook', ['webhook'], ['/chat/webhook']),
};
