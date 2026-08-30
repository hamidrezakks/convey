import { describe, expect, it } from 'bun:test';
import { emailHandlers } from '../src/handlers/email';

describe('Email Provider Handlers', () => {
  it('handles Resend POST /emails with 200 OK and id', async () => {
    const handler = emailHandlers.resend;
    const req = new Request('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer re_test_key_12345',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@convey.dev',
        to: 'user@example.com',
        subject: 'Hello World',
        html: '<p>Welcome</p>',
      }),
    });

    const res = await handler.handle(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { id: string };
    expect(data.id).toMatch(/^re_/);
  });

  it('rejects Resend requests without recipient with 422', async () => {
    const handler = emailHandlers.resend;
    const req = new Request('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer re_test_key_12345',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@convey.dev',
        subject: 'Missing to field',
      }),
    });

    const res = await handler.handle(req);
    expect(res.status).toBe(422);
    const err = (await res.json()) as { message: string; name: string };
    expect(err.name).toBe('validation_error');
  });

  it('handles SendGrid POST /v3/mail/send with 202 Accepted and X-Message-Id header', async () => {
    const handler = emailHandlers.sendgrid;
    const req = new Request('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer SG.test_key_12345',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: 'user@example.com' }] }],
        from: { email: 'from@convey.dev' },
        content: [{ type: 'text/plain', value: 'Hello SendGrid' }],
      }),
    });

    const res = await handler.handle(req);
    expect(res.status).toBe(202);
    expect(res.headers.get('x-message-id')).toBeDefined();
  });

  it('handles AWS SES POST /v2/email/outbound-emails with 200 OK and MessageId', async () => {
    const handler = emailHandlers.ses;
    const req = new Request('https://email.us-east-1.amazonaws.com/v2/email/outbound-emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20260830/us-east-1/ses/aws4_request',
      },
      body: JSON.stringify({
        Destination: { ToAddresses: ['user@example.com'] },
        FromEmailAddress: 'sender@convey.dev',
        Content: { Simple: { Subject: { Data: 'SES Test' }, Body: { Text: { Data: 'Hello SES' } } } },
      }),
    });

    const res = await handler.handle(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { MessageId: string };
    expect(data.MessageId).toMatch(/^010001/);
  });

  it('handles Mailgun POST /v3/:domain/messages with 200 OK and message ID', async () => {
    const handler = emailHandlers.mailgun;
    const req = new Request('https://api.mailgun.net/v3/sandbox123.mailgun.org/messages', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa('api:key-1234567890')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'mailgun@sandbox123.mailgun.org',
        to: 'user@example.com',
        subject: 'Mailgun Test',
        text: 'Hello Mailgun',
      }),
    });

    const res = await handler.handle(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { id: string; message: string };
    expect(data.id).toContain('@');
    expect(data.message).toBe('Queued. Thank you.');
  });

  it('handles Postmark POST /email with 200 OK', async () => {
    const handler = emailHandlers.postmark;
    const req = new Request('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': 'postmark-server-token-123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        From: 'support@convey.dev',
        To: 'user@example.com',
        Subject: 'Postmark Email',
        TextBody: 'Hello Postmark',
      }),
    });

    const res = await handler.handle(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { MessageID: string; ErrorCode: number };
    expect(data.ErrorCode).toBe(0);
    expect(data.MessageID).toBeDefined();
  });

  it('handles Brevo POST /v3/smtp/email with 201 Created and messageId', async () => {
    const handler = emailHandlers.brevo;
    const req = new Request('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': 'xkeysib-mock-key-12345',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: 'support@convey.dev', name: 'Convey' },
        to: [{ email: 'user@example.com' }],
        subject: 'Brevo Welcome',
        htmlContent: '<p>Hello Brevo</p>',
      }),
    });

    const res = await handler.handle(req);
    expect(res.status).toBe(201);
    const data = (await res.json()) as { messageId: string };
    expect(data.messageId).toContain('@smtp-relay.mailin.fr');
  });

  it('handles generic email providers (Plunk, SparkPost, Mailjet, Mailtrap, etc.)', async () => {
    const handler = emailHandlers.plunk;
    const req = new Request('https://api.useplunk.com/v1/send', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer plunk_key_123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: 'user@example.com',
        subject: 'Plunk Test',
        body: 'Hello Plunk',
      }),
    });

    const res = await handler.handle(req);
    expect(res.status).toBe(200);
  });
});
