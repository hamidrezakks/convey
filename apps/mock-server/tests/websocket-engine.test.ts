import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { startMockServer } from '../src/index';

describe('Mock Server WebSocket Protocols & Live Streaming', () => {
  let server: ReturnType<typeof startMockServer>;
  let wsUrl: string;

  beforeAll(() => {
    server = startMockServer(4199);
    wsUrl = `ws://localhost:${server.port}`;
  });

  afterAll(() => {
    server.stop(true);
  });

  it('connects to Live Inspector WebSocket and receives welcome greeting', async () => {
    const ws = new WebSocket(`${wsUrl}/ws`);

    const messagePromise = new Promise<Record<string, unknown>>((resolve) => {
      ws.onmessage = (event) => {
        const data = JSON.parse(String(event.data));
        resolve(data);
      };
    });

    const greeting = await messagePromise;
    expect(greeting.type).toBe('convey.mock.welcome');
    expect(greeting.status).toBe('connected');
    expect(Array.isArray(greeting.features)).toBe(true);

    ws.close();
  });

  it('handles Inspector WebSocket ping/pong', async () => {
    const ws = new WebSocket(`${wsUrl}/__inspect/ws`);

    await new Promise((resolve) => {
      ws.onopen = resolve;
    });

    const pongPromise = new Promise<Record<string, unknown>>((resolve) => {
      ws.onmessage = (event) => {
        const data = JSON.parse(String(event.data));
        if (data.type === 'pong') {
          resolve(data);
        }
      };
    });

    ws.send(JSON.stringify({ type: 'ping' }));
    const pong = await pongPromise;
    expect(pong.type).toBe('pong');
    expect(pong.timestamp).toBeDefined();

    ws.close();
  });

  it('implements authentic Pusher WebSocket protocol handshake and channel subscription', async () => {
    const ws = new WebSocket(`${wsUrl}/app/mock_pusher_key?protocol=7&client=js&version=8.0.0`);

    const messages: Array<Record<string, unknown>> = [];
    const connectionPromise = new Promise<void>((resolve) => {
      ws.onmessage = (event) => {
        const data = JSON.parse(String(event.data));
        messages.push(data);
        if (data.event === 'pusher:connection_established') {
          resolve();
        }
      };
    });

    await connectionPromise;
    const established = messages.find((m) => m.event === 'pusher:connection_established');
    expect(established).toBeDefined();
    const connData = JSON.parse(String(established!.data));
    expect(connData.socket_id).toBeDefined();
    expect(connData.activity_timeout).toBe(120);

    // Test Pusher Subscribe
    const subPromise = new Promise<Record<string, unknown>>((resolve) => {
      ws.onmessage = (event) => {
        const data = JSON.parse(String(event.data));
        if (data.event === 'pusher_internal:subscription_succeeded') {
          resolve(data);
        }
      };
    });

    ws.send(
      JSON.stringify({
        event: 'pusher:subscribe',
        data: { channel: 'orders-channel' },
      }),
    );

    const subResponse = await subPromise;
    expect(subResponse.event).toBe('pusher_internal:subscription_succeeded');
    expect(subResponse.channel).toBe('orders-channel');

    ws.close();
  });

  it('implements authentic Slack Socket Mode WebSocket handshake and ping-pong', async () => {
    const ws = new WebSocket(`${wsUrl}/slack/socket-mode`);

    const helloPromise = new Promise<Record<string, unknown>>((resolve) => {
      ws.onmessage = (event) => {
        const data = JSON.parse(String(event.data));
        if (data.type === 'hello') {
          resolve(data);
        }
      };
    });

    const hello = await helloPromise;
    expect(hello.type).toBe('hello');
    expect(hello.num_connections).toBe(1);

    // Test Ping / Pong
    const pongPromise = new Promise<Record<string, unknown>>((resolve) => {
      ws.onmessage = (event) => {
        const data = JSON.parse(String(event.data));
        if (data.type === 'pong') {
          resolve(data);
        }
      };
    });

    ws.send(JSON.stringify({ type: 'ping', id: 42 }));
    const pong = await pongPromise;
    expect(pong.type).toBe('pong');
    expect(pong.reply_to).toBe(42);

    ws.close();
  });

  it('implements authentic Discord Gateway WebSocket Opcode 10 Hello and Opcode 1 Heartbeat', async () => {
    const ws = new WebSocket(`${wsUrl}/discord/gateway`);

    const helloPromise = new Promise<Record<string, unknown>>((resolve) => {
      ws.onmessage = (event) => {
        const data = JSON.parse(String(event.data));
        if (data.op === 10) {
          resolve(data);
        }
      };
    });

    const hello = await helloPromise;
    expect(hello.op).toBe(10);
    const helloData = hello.d as { heartbeat_interval: number };
    expect(helloData.heartbeat_interval).toBe(41250);

    // Send Heartbeat (Opcode 1) -> Expect Heartbeat ACK (Opcode 11)
    const ackPromise = new Promise<Record<string, unknown>>((resolve) => {
      ws.onmessage = (event) => {
        const data = JSON.parse(String(event.data));
        if (data.op === 11) {
          resolve(data);
        }
      };
    });

    ws.send(JSON.stringify({ op: 1, d: null }));
    const ack = await ackPromise;
    expect(ack.op).toBe(11);

    ws.close();
  });

  it('broadcasts live mock request events to connected Inspector WebSockets', async () => {
    const ws = new WebSocket(`${wsUrl}/events`);

    await new Promise((resolve) => {
      ws.onopen = resolve;
    });

    const eventPromise = new Promise<Record<string, unknown>>((resolve) => {
      ws.onmessage = (event) => {
        const data = JSON.parse(String(event.data));
        if (data.type === 'mock.request') {
          resolve(data);
        }
      };
    });

    // Make an HTTP request to the mock server to trigger a broadcast event
    await fetch(`http://localhost:${server.port}/emails`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer re_mock_token_123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'sender@convey.dev',
        to: 'user@convey.dev',
        subject: 'Live Event Stream Test',
      }),
    });

    const broadcast = await eventPromise;
    expect(broadcast.type).toBe('mock.request');
    const reqData = broadcast.data as { providerId: string; status: number };
    expect(reqData.providerId).toBe('resend');
    expect(reqData.status).toBe(200);

    ws.close();
  });
});
