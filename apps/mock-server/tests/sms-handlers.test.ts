import { describe, expect, it } from 'bun:test';
import { smsHandlers } from '../src/handlers/sms';

describe('SMS Provider Handlers', () => {
  it('handles Twilio POST Messages.json with form-urlencoded body and Basic Auth', async () => {
    const handler = smsHandlers.twilio;
    const body = new URLSearchParams({
      To: '+15550192834',
      From: '+15559876543',
      Body: 'Your security code is 123456.',
    }).toString();

    const req = new Request('https://api.twilio.com/2010-04-01/Accounts/ACmock1234567890abcdef/Messages.json', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa('ACmock1234567890abcdef:mocktoken123456')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const res = await handler.handle(req);
    expect(res.status).toBe(201);
    const data = (await res.json()) as { sid: string; status: string; to: string; from: string };
    expect(data.sid).toMatch(/^SM/);
    expect(data.status).toBe('queued');
    expect(data.to).toBe('+15550192834');
    expect(data.from).toBe('+15559876543');
  });

  it('rejects Twilio requests with invalid Account SID format', async () => {
    const handler = smsHandlers.twilio;
    const req = new Request('https://api.twilio.com/2010-04-01/Accounts/invalid_sid/Messages.json', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa('invalid_sid:mocktoken')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: '+15550192834', From: '+15559876543', Body: 'Test' }).toString(),
    });

    const res = await handler.handle(req);
    expect(res.status).toBe(401);
    const err = (await res.json()) as { code: number; message: string };
    expect(err.code).toBe(20003);
  });

  it('handles Infobip POST /sms/2/text/advanced', async () => {
    const handler = smsHandlers.infobip;
    const req = new Request('https://api.infobip.com/sms/2/text/advanced', {
      method: 'POST',
      headers: {
        Authorization: 'App mock_api_key_12345',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ destinations: [{ to: '41793026727' }], from: 'Convey', text: 'Infobip SMS' }],
      }),
    });

    const res = await handler.handle(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { messages: Array<{ messageId: string; status: { name: string } }> };
    expect(data.messages[0].messageId).toBeDefined();
    expect(data.messages[0].status.name).toBe('PENDING_ENROUTE');
  });

  it('handles Plivo POST /v1/Account/:authId/Message/', async () => {
    const handler = smsHandlers.plivo;
    const req = new Request('https://api.plivo.com/v1/Account/MOCKAUTHID123/Message/', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa('MOCKAUTHID123:mockauth')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        src: '+15551234567',
        dst: '+15557654321',
        text: 'Plivo test message',
      }),
    });

    const res = await handler.handle(req);
    expect(res.status).toBe(202);
    const data = (await res.json()) as { message_uuid: string[]; message: string };
    expect(data.message_uuid).toBeDefined();
    expect(data.message).toBe('message(s) queued');
  });

  it('handles Telnyx POST /v2/messages', async () => {
    const handler = smsHandlers.telnyx;
    const req = new Request('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer KEY012345_mock',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: '+15551234567',
        to: '+15557654321',
        text: 'Telnyx SMS',
      }),
    });

    const res = await handler.handle(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { data: { id: string; record_type: string } };
    expect(data.data.id).toBeDefined();
    expect(data.data.record_type).toBe('message');
  });

  it('handles Bandwidth POST /v2/users/:accountId/messages', async () => {
    const handler = smsHandlers.bandwidth;
    const req = new Request('https://api.bandwidth.com/v2/users/u-12345/messages', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa('mockuser:mockpass')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: ['+15551234567'],
        from: '+15557654321',
        text: 'Bandwidth message',
        applicationId: 'app-123',
      }),
    });

    const res = await handler.handle(req);
    expect(res.status).toBe(202);
    const data = (await res.json()) as { id: string };
    expect(data.id).toMatch(/^m-/);
  });

  it('handles Cequens POST /api/sms/v1/messages', async () => {
    const handler = smsHandlers.cequens;
    const req = new Request('https://developer.cequens.com/api/sms/v1/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer mock_cequens_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: '+15550192834',
        senderName: 'Convey',
        message: 'Cequens test message',
      }),
    });

    const res = await handler.handle(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { replyCode: number; data: { messageId: string } };
    expect(data.replyCode).toBe(0);
    expect(data.data.messageId).toBeDefined();
  });
});
