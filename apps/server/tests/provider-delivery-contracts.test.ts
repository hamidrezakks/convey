import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { generateKeyPairSync, verify } from 'node:crypto';
import { createServer as createHttp2Server, type ServerHttp2Stream } from 'node:http2';
import { type AddressInfo, createServer } from 'node:net';
import { SESv2Client } from '@aws-sdk/client-sesv2';
import { SNSClient } from '@aws-sdk/client-sns';
import { SmsClient } from '@azure/communication-sms';
import { ErrorCategory } from '../src/modules/providers/core/provider-types';
import { http2Request } from '../src/modules/providers/core/transport/http2-request';
import { NodemailerEmailAdapter } from '../src/modules/providers/email/nodemailer/nodemailer.adapter';
import { Outlook365EmailAdapter } from '../src/modules/providers/email/outlook365/outlook365.adapter';
import { SesEmailAdapter } from '../src/modules/providers/email/ses/ses.adapter';
import { ApnsPushAdapter } from '../src/modules/providers/push/apns/apns.adapter';
import { FcmPushAdapter } from '../src/modules/providers/push/fcm/fcm.adapter';
import { AzureSmsSmsAdapter } from '../src/modules/providers/sms/azure-sms/azure-sms.adapter';
import { SnsSmsAdapter } from '../src/modules/providers/sms/sns/sns.adapter';
import { TwilioSmsAdapter } from '../src/modules/providers/sms/twilio/twilio.adapter';

const email = {
  recipient: { email: 'recipient@example.test' },
  from: 'sender@example.test',
  content: { subject: 'Contract', text: 'Hello' },
};
const sms = { recipient: { phone: '+15005550006' }, from: '+15005550007', content: { text: 'Hello' } };
const restores: Array<() => void> = [];
afterEach(() => {
  for (const restore of restores.splice(0)) restore();
});
function interceptFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const mock = spyOn(globalThis, 'fetch').mockImplementation(((input: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(handler(String(input), init))) as typeof fetch);
  restores.push(() => mock.mockRestore());
  return mock;
}

describe('native delivery contracts', () => {
  it('SMTP transmits DATA and waits for the server acknowledgement', async () => {
    let received = '';
    const server = createServer((socket) => {
      socket.write('220 localhost ESMTP\r\n');
      let buffer = '';
      let inData = false;
      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        while (buffer.includes('\r\n')) {
          const end = buffer.indexOf('\r\n');
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (inData) {
            if (line === '.') {
              inData = false;
              socket.write('250 queued\r\n');
            } else received += `${line}\n`;
          } else if (line.startsWith('EHLO')) socket.write('250 localhost\r\n');
          else if (line === 'DATA') {
            inData = true;
            socket.write('354 Send content\r\n');
          } else if (line === 'QUIT') socket.end('221 bye\r\n');
          else socket.write('250 OK\r\n');
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const result = await new NodemailerEmailAdapter({
        host: '127.0.0.1',
        port: (server.address() as AddressInfo).port,
      }).send(email);
      expect(result.success).toBe(true);
      expect(received).toContain('Subject: Contract');
      expect(received).toContain('Hello');
      expect(result.providerMessageId).toBeTruthy();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  it('SMTP rejects missing configuration and empty acceptance lists', async () => {
    const adapter = new NodemailerEmailAdapter();
    expect((await adapter.send(email)).error?.code).toBe('MISSING_CREDENTIALS');
    expect(adapter.hasSetup({ host: 'smtp.example.test', user: 'u' })).toBe(false);
    expect(adapter.transformResponse({ messageId: 'id', accepted: [], rejected: ['x'] }).success).toBe(false);
  });
  it('Outlook obtains OAuth credentials and accepts an empty 202 without fabricating an ID', async () => {
    const mock = interceptFetch((url, init) => {
      if (url.includes('login.microsoftonline.com')) {
        const body = new URLSearchParams(String(init?.body));
        expect(body.get('scope')).toBe('https://graph.microsoft.com/.default');
        expect(body.get('client_secret')).toBe('secret');
        return Response.json({ access_token: 'real-token' });
      }
      expect(url).toBe('https://graph.microsoft.com/v1.0/users/sender%40example.test/sendMail');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer real-token');
      return new Response(null, { status: 202 });
    });
    const adapter = new Outlook365EmailAdapter({
      clientId: 'client',
      clientSecret: 'secret',
      tenantId: 'tenant',
      fromUser: email.from,
    });
    const result = await adapter.send(email);
    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBeUndefined();
    expect(mock).toHaveBeenCalledTimes(2);
    expect(adapter.parseWebhook({ value: [{ resourceData: { id: 'change-id' } }] })).toEqual([]);
  });
  it('Outlook stops before sending when token exchange fails', async () => {
    const mock = interceptFetch(() => Response.json({ error: 'invalid_client' }, { status: 401 }));
    const result = await new Outlook365EmailAdapter({ clientId: 'c', clientSecret: 's', tenantId: 't' }).send(email);
    expect(result.error?.category).toBe(ErrorCategory.PERMANENT);
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('Twilio posts URL-encoded data with account authentication and repeated media URLs', async () => {
    interceptFetch((url, init) => {
      expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json');
      expect(new Headers(init?.headers).get('authorization')).toBe(
        `Basic ${Buffer.from('ACtest:secret').toString('base64')}`,
      );
      expect(new URLSearchParams(String(init?.body)).getAll('MediaUrl')).toEqual([
        'https://example.test/1',
        'https://example.test/2',
      ]);
      return Response.json({ sid: 'SM123' }, { status: 201 });
    });
    const result = await new TwilioSmsAdapter({ accountSid: 'ACtest', authToken: 'secret' }).send({
      ...sms,
      content: { ...sms.content, mediaUrl: ['https://example.test/1', 'https://example.test/2'] },
    });
    expect(result.providerMessageId).toBe('SM123');
  });
  it('AWS clients receive the real SES and SNS commands', async () => {
    const ses = spyOn(SESv2Client.prototype, 'send').mockImplementation(async (command: unknown) => {
      expect((command as { input: { Destination: { ToAddresses: string[] } } }).input.Destination.ToAddresses).toEqual([
        'recipient@example.test',
      ]);
      return { MessageId: 'ses-id', $metadata: { httpStatusCode: 200 } };
    });
    const sns = spyOn(SNSClient.prototype, 'send').mockImplementation(async (command: unknown) => {
      expect((command as { input: { PhoneNumber: string } }).input.PhoneNumber).toBe(sms.recipient.phone);
      return { MessageId: 'sns-id', $metadata: { httpStatusCode: 200 } };
    });
    restores.push(
      () => ses.mockRestore(),
      () => sns.mockRestore(),
    );
    const config = { region: 'us-east-1', accessKeyId: 'test', secretAccessKey: 'secret' };
    expect((await new SesEmailAdapter(config).send(email)).providerMessageId).toBe('ses-id');
    expect((await new SnsSmsAdapter(config).send(sms)).providerMessageId).toBe('sns-id');
  });
  it('Azure calls its SDK and propagates per-recipient rejection', async () => {
    const mock = spyOn(SmsClient.prototype, 'send').mockResolvedValue([
      { to: sms.recipient.phone, successful: false, httpStatusCode: 400, errorMessage: 'Rejected', messageId: '' },
    ]);
    restores.push(() => mock.mockRestore());
    const result = await new AzureSmsSmsAdapter({
      connectionString: `endpoint=https://unit.communication.azure.com/;accesskey=${Buffer.from('test').toString('base64')}`,
    }).send(sms);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
  });
  it('FCM signs a service-account assertion and calls HTTP v1 with a cached OAuth token', async () => {
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const config = {
      projectId: 'test-project',
      email: 'test@example.test',
      privateKey: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    };
    let exchanges = 0;
    interceptFetch((url, init) => {
      if (url === 'https://oauth2.googleapis.com/token') {
        exchanges++;
        const jwt = new URLSearchParams(String(init?.body)).get('assertion') || '';
        const [header, claims, signature] = jwt.split('.');
        expect(
          verify(
            'sha256',
            Buffer.from(`${header}.${claims}`),
            keys.publicKey,
            Buffer.from(signature || '', 'base64url'),
          ),
        ).toBe(true);
        expect(JSON.parse(Buffer.from(claims || '', 'base64url').toString()).scope).toBe(
          'https://www.googleapis.com/auth/firebase.messaging',
        );
        return Response.json({ access_token: 'fcm-oauth', expires_in: 3600 });
      }
      expect(url).toBe('https://fcm.googleapis.com/v1/projects/test-project/messages:send');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer fcm-oauth');
      expect(JSON.parse(String(init?.body)).message).toMatchObject({ token: 'device', data: { count: '2' } });
      return Response.json({ name: 'projects/test-project/messages/id' });
    });
    const adapter = new FcmPushAdapter(config);
    const options = { recipient: { fcmTokens: ['device'] }, content: { text: 'Hello', data: { count: 2 } } };
    expect((await adapter.send(options)).success).toBe(true);
    expect((await adapter.send(options)).success).toBe(true);
    expect(exchanges).toBe(1);
    expect((await adapter.send({ ...options, recipient: { fcmTokens: ['a', 'b'] } })).success).toBe(false);
    expect(adapter.hasSetup({ privateKey: '', secretKey: 'legacy' })).toBe(false);
  });
  it('APNs signs ES256 authorization and protects aps from custom data overrides', async () => {
    const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const adapter = new ApnsPushAdapter(
      {
        key: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        keyId: 'KEY',
        teamId: 'TEAM',
        bundleId: 'com.example.app',
      },
      async (origin, path, headers, body) => {
        expect(origin).toBe('https://api.sandbox.push.apple.com');
        expect(path).toBe('/3/device/device');
        const [header, claims, signature] = String(headers.authorization).slice(7).split('.');
        expect(
          verify(
            'sha256',
            Buffer.from(`${header}.${claims}`),
            { key: keys.publicKey, dsaEncoding: 'ieee-p1363' },
            Buffer.from(signature || '', 'base64url'),
          ),
        ).toBe(true);
        expect(JSON.parse(body).aps.alert.body).toBe('Hello');
        return { status: 200, headers: { 'apns-id': 'real-apns-id' }, body: '' };
      },
    );
    const result = await adapter.send({
      recipient: { deviceTokens: ['device'] },
      content: { body: 'Hello', data: { aps: { alert: 'incorrect' } } },
    });
    expect(result.providerMessageId).toBe('real-apns-id');
    expect(adapter.hasSetup({ keyId: '' })).toBe(false);
  });
  it('HTTP/2 transport exchanges actual frames with a local peer', async () => {
    const server = createHttp2Server();
    server.on('stream', (stream, headers) => {
      expect(headers[':path']).toBe('/3/device/test');
      (stream as ServerHttp2Stream).respond({ ':status': 200, 'apns-id': 'h2-id' });
      stream.end('{}');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const response = await http2Request(
        `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        '/3/device/test',
        {},
        '{}',
      );
      expect(response.status).toBe(200);
      expect(response.headers['apns-id']).toBe('h2-id');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
