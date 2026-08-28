import { describe, expect, it } from 'bun:test';
import { Convey, MessageBuilder, MessagePriority } from '../src';

describe('Fluent Message & Batch Builders Suite', () => {
  it('should construct and build message payload using chainable DSL', () => {
    const builder = new MessageBuilder()
      .to('alice@example.com')
      .email({ subject: 'Invoice #101', html: '<p>Paid</p>' })
      .priority(MessagePriority.HIGH)
      .team('finance')
      .metadata({ customerId: 'cust_999' })
      .idempotencyKey('idem_123');

    const payload = builder.build();
    expect(payload.recipient).toBe('alice@example.com');
    expect(payload.channel).toBe('EMAIL');
    expect(payload.content?.subject).toBe('Invoice #101');
    expect(payload.content?.body).toBe('<p>Paid</p>');
    expect(payload.priority).toBe(MessagePriority.HIGH);
    expect(payload.team).toBe('finance');
    expect(payload.metadata).toEqual({ customerId: 'cust_999' });
    expect(payload.idempotencyKey).toBe('idem_123');
  });

  it('should support channel shortcut helpers (email, sms, whatsapp, slack, push)', () => {
    const sms = new MessageBuilder().sms({ to: '+1234567890', body: 'Verification code: 1234' }).build();
    expect(sms.channel).toBe('SMS');
    expect(sms.recipient).toBe('+1234567890');
    expect(sms.content?.body).toBe('Verification code: 1234');

    const slack = new MessageBuilder().slack({ channelId: 'C12345', text: 'Alert fired!' }).build();
    expect(slack.channel).toBe('SLACK');
    expect(slack.recipient).toBe('C12345');

    const push = new MessageBuilder().push({ token: 'tok_abc', title: 'New Message', body: 'Hi' }).build();
    expect(push.channel).toBe('PUSH');
    expect(push.recipient).toBe('tok_abc');
    expect(push.content?.subject).toBe('New Message');
  });

  it('should dispatch message directly via client.message().send()', async () => {
    let capturedBody: unknown;
    const mockFetch = async (_url: unknown, init?: RequestInit): Promise<Response> => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ success: true, publicId: 'msg_builder_01', status: 'ACCEPTED' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_123',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const res = await client.message().to('bob@test.com').email({ subject: 'Welcome', text: 'Welcome aboard!' }).send();

    expect(res.publicId).toBe('msg_builder_01');
    expect(capturedBody).toBeDefined();
  });

  it('should stage and chunk batch messages with client.batches.builder()', async () => {
    let batchRequestCount = 0;
    const mockFetch = async (_url: unknown, init?: RequestInit): Promise<Response> => {
      batchRequestCount++;
      const body = JSON.parse(init?.body as string);
      const items = (body.messages || []).map((_m: unknown, idx: number) => ({
        publicId: `msg_chunk_${batchRequestCount}_${idx}`,
        status: 'ACCEPTED',
      }));
      return new Response(JSON.stringify({ total: items.length, items }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new Convey({
      apiKey: 'sk_live_123',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const batchBuilder = client.batches.builder(client.messages);
    for (let i = 0; i < 25; i++) {
      batchBuilder.add(
        client
          .message()
          .to(`user_${i}@test.com`)
          .email({ subject: `Update ${i}`, body: 'Batch item' }),
      );
    }

    expect(batchBuilder.length).toBe(25);

    let progressCalls = 0;
    const result = await batchBuilder.dispatch({
      chunkSize: 10,
      concurrency: 2,
      onProgress: (completed, total) => {
        progressCalls++;
        expect(total).toBe(25);
        expect(completed).toBeGreaterThan(0);
      },
    });

    expect(batchRequestCount).toBe(3); // 10 + 10 + 5 = 3 chunks
    expect(result.total).toBe(25);
    expect(result.items.length).toBe(25);
    expect(progressCalls).toBe(3);
  });
});
