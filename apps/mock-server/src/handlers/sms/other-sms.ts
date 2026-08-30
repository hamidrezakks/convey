import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class GenericSmsMockHandler implements ProviderMockHandler {
  readonly id: string;
  readonly channel = 'sms' as const;
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
      this.paths.some((p) => path.includes(p.toLowerCase())) ||
      path.includes(this.id)
    );
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const authHeader = req.headers.get('authorization') || req.headers.get('api-key') || '';
    const authDisplay = authHeader ? 'API Credentials (Valid)' : 'None / Missing';

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      // urlencoded or text
    }

    const recipient = String(body.to || body.recipient || body.dst || body.phoneNumber || '+15550000000');
    const from = String(body.from || body.sender || body.src || 'Convey');
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
      from,
      messageId,
      payloadSummary: `${JSON.stringify(body).length} bytes`,
      action: "Scheduled async 'delivered' DLR callback in 400ms",
    });

    return new Response(
      JSON.stringify({
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

export const otherSmsHandlers: Record<string, ProviderMockHandler> = {
  messagebird: new GenericSmsMockHandler('messagebird', ['messagebird.com'], ['/messages']),
  sinch: new GenericSmsMockHandler('sinch', ['sinch.com'], ['/batches']),
  nexmo: new GenericSmsMockHandler('nexmo', ['nexmo.com', 'vonage.com'], ['/sms/json']),
  termii: new GenericSmsMockHandler('termii', ['termii.com'], ['/api/sms/send']),
  'afro-sms': new GenericSmsMockHandler('afro-sms', ['afrosms.com'], ['/api/send']),
  'cm-telecom': new GenericSmsMockHandler('cm-telecom', ['cmtelecom.com', 'cm.com'], ['/gateway.ashx']),
  'ring-central': new GenericSmsMockHandler('ring-central', ['ringcentral.com'], ['/sms']),
  'azure-sms': new GenericSmsMockHandler('azure-sms', ['communication.azure.com'], ['/sms']),
  gupshup: new GenericSmsMockHandler('gupshup', ['gupshup.io'], ['/msg']),
  clicksend: new GenericSmsMockHandler('clicksend', ['clicksend.com'], ['/sms/send']),
  simpletexting: new GenericSmsMockHandler('simpletexting', ['simpletexting.com'], ['/messages']),
  kannel: new GenericSmsMockHandler('kannel', ['kannel'], ['/cgi-bin/sendsms']),
  cequens: new GenericSmsMockHandler('cequens', ['cequens.com'], ['/api/sms/v1/messages']),
  sms77: new GenericSmsMockHandler('sms77', ['sms77.io'], ['/api/sms']),
  maqsam: new GenericSmsMockHandler('maqsam', ['maqsam.com'], ['/v1/sms/send']),
  'burst-sms': new GenericSmsMockHandler('burst-sms', ['burstsms.com'], ['/send-sms.json']),
  'generic-sms': new GenericSmsMockHandler('generic-sms', ['generic-sms'], ['/sms/send']),
  sendchamp: new GenericSmsMockHandler('sendchamp', ['sendchamp.com'], ['/api/v1/sms/send']),
  'africas-talking': new GenericSmsMockHandler('africas-talking', ['africastalking.com'], ['/messaging']),
  'brevo-sms': new GenericSmsMockHandler('brevo-sms', ['brevo.com'], ['/transactionalSMS/send']),
  'bulk-sms': new GenericSmsMockHandler('bulk-sms', ['bulksms.com'], ['/messages']),
  clickatell: new GenericSmsMockHandler('clickatell', ['clickatell.com'], ['/messages']),
  'eazy-sms': new GenericSmsMockHandler('eazy-sms', ['eazysms.com'], ['/api/sms']),
  firetext: new GenericSmsMockHandler('firetext', ['firetext.co.uk'], ['/api/sendsms']),
  'forty-six-elks': new GenericSmsMockHandler('forty-six-elks', ['46elks.com'], ['/SMS']),
  imedia: new GenericSmsMockHandler('imedia', ['imedia.com'], ['/sms']),
  'isend-sms': new GenericSmsMockHandler('isend-sms', ['isendsms.com'], ['/api/sms']),
  'isendpro-sms': new GenericSmsMockHandler('isendpro-sms', ['isendpro.com'], ['/sms/send']),
  mobishastra: new GenericSmsMockHandler('mobishastra', ['mobishastra.com'], ['/send']),
  'ruach-sms': new GenericSmsMockHandler('ruach-sms', ['ruachsms.com'], ['/send']),
  'sms-central': new GenericSmsMockHandler('sms-central', ['smscentral.com.au'], ['/api/sms']),
  smsmode: new GenericSmsMockHandler('smsmode', ['smsmode.com'], ['/http/1.6/sendSMS.do']),
  sns: new GenericSmsMockHandler('sns', ['sns.amazonaws.com'], ['/sns']),
  unifonic: new GenericSmsMockHandler('unifonic', ['unifonic.com'], ['/rest/SMS/messages']),
};
