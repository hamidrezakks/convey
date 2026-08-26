import { describe, expect, it, mock } from 'bun:test';
import { Convey } from '../src/client';

describe('SDK: Templates, Preferences, and Inbox Resources', () => {
  const client = new Convey({
    apiKey: 'convey_test_key_123',
    baseUrl: 'https://api.convey.dev',
  });

  it('exposes templates, preferences, and inbox resources on Convey client instance', () => {
    expect(client.templates).toBeDefined();
    expect(client.preferences).toBeDefined();
    expect(client.inbox).toBeDefined();
    expect(typeof client.templates.list).toBe('function');
    expect(typeof client.templates.create).toBe('function');
    expect(typeof client.templates.render).toBe('function');
    expect(typeof client.preferences.listTopics).toBe('function');
    expect(typeof client.preferences.check).toBe('function');
    expect(typeof client.inbox.create).toBe('function');
    expect(typeof client.inbox.getFeed).toBe('function');
  });

  it('correctly constructs render template payload and options', async () => {
    const mockRequest = mock(() =>
      Promise.resolve({
        success: true,
        rendered: {
          channel: 'email',
          subject: 'Order #123 Confirmed',
          html: '<h1>Order #123</h1>',
          localeUsed: 'en-US',
          resolvedPartials: [],
        },
      }),
    );

    // @ts-expect-error override private http client request for unit testing
    client.templates.http.request = mockRequest;

    const result = await client.templates.render({
      templateSlug: 'order_confirmed',
      channel: 'email',
      variables: { orderId: '123' },
      locale: 'en-US',
    });

    expect(result.success).toBe(true);
    expect(result.rendered.subject).toBe('Order #123 Confirmed');
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
});
