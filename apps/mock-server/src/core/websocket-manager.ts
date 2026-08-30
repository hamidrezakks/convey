import type { ServerWebSocket } from 'bun';
import { mockLogger } from './logger';

export interface WebSocketClientData {
  id: string;
  topic: 'inspector' | 'pusher' | 'slack' | 'discord' | 'mattermost' | 'stream' | 'general';
  connectedAt: Date;
  subscribedChannels?: Set<string>;
}

export class MockWebSocketManager {
  private clients = new Set<ServerWebSocket<WebSocketClientData>>();

  /** Register an active WebSocket connection */
  register(ws: ServerWebSocket<WebSocketClientData>): void {
    this.clients.add(ws);
    mockLogger.info(`[WEBSOCKET] Client connected: ${ws.data.id} (Topic: ${ws.data.topic})`, {
      clientId: ws.data.id,
      topic: ws.data.topic,
      totalClients: this.clients.size,
    });

    // Send initial protocol greeting frame after connection establishes
    setTimeout(() => {
      try {
        this.sendInitialGreeting(ws);
      } catch {
        // ignore if closed early
      }
    }, 15);
  }

  /** Unregister a disconnected WebSocket */
  unregister(ws: ServerWebSocket<WebSocketClientData>): void {
    this.clients.delete(ws);
    mockLogger.info(`[WEBSOCKET] Client disconnected: ${ws.data.id}`, {
      clientId: ws.data.id,
      totalClients: this.clients.size,
    });
  }

  /** Handle incoming WebSocket message based on provider protocol */
  handleMessage(ws: ServerWebSocket<WebSocketClientData>, message: string | Buffer): void {
    const raw = typeof message === 'string' ? message : message.toString('utf-8');
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Plaintext ping/pong
      if (raw === 'ping') {
        ws.send('pong');
        return;
      }
    }

    const { topic } = ws.data;

    // 1. Pusher Protocol Handler
    if (topic === 'pusher') {
      const event = String(parsed.event || '');
      if (event === 'pusher:ping') {
        ws.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
      } else if (event === 'pusher:subscribe') {
        const channel = (parsed.data as { channel?: string })?.channel || 'default';
        if (!ws.data.subscribedChannels) ws.data.subscribedChannels = new Set();
        ws.data.subscribedChannels.add(channel);
        ws.send(
          JSON.stringify({
            event: 'pusher_internal:subscription_succeeded',
            channel,
            data: {},
          }),
        );
      }
      return;
    }

    // 2. Slack Socket Mode Protocol Handler
    if (topic === 'slack') {
      if (parsed.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', reply_to: parsed.id }));
      }
      return;
    }

    // 3. Discord Gateway Protocol Handler
    if (topic === 'discord') {
      const op = Number(parsed.op);
      if (op === 1) {
        // Heartbeat -> Heartbeat ACK (Opcode 11)
        ws.send(JSON.stringify({ op: 11 }));
      } else if (op === 2) {
        // Identify -> Ready (Opcode 0)
        ws.send(
          JSON.stringify({
            op: 0,
            t: 'READY',
            d: {
              v: 10,
              user: { id: 'mock_discord_bot', username: 'ConveyBot', bot: true },
              guilds: [],
              session_id: 'mock_session_123',
            },
          }),
        );
      }
      return;
    }

    // 4. Mattermost / Stream Chat Protocol
    if (topic === 'mattermost' || topic === 'stream') {
      if (parsed.action === 'ping' || parsed.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
      return;
    }

    // 5. Inspector / General Protocol
    if (parsed.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
    }
  }

  /** Send authentic initial handshake per protocol */
  private sendInitialGreeting(ws: ServerWebSocket<WebSocketClientData>): void {
    const { topic } = ws.data;

    switch (topic) {
      case 'pusher':
        ws.send(
          JSON.stringify({
            event: 'pusher:connection_established',
            data: JSON.stringify({
              socket_id: `${Math.floor(Math.random() * 900000) + 100000}.${Math.floor(Math.random() * 900000) + 100000}`,
              activity_timeout: 120,
            }),
          }),
        );
        break;

      case 'slack':
        ws.send(
          JSON.stringify({
            type: 'hello',
            num_connections: 1,
            region: 'us-east-1',
            connection_info: { app_id: 'A_MOCK_CONVEY_APP' },
          }),
        );
        break;

      case 'discord':
        // Discord Gateway Hello (Opcode 10)
        ws.send(
          JSON.stringify({
            op: 10,
            d: {
              heartbeat_interval: 41250,
              _trace: ['["gateway-mock",{"micros":500}]'],
            },
          }),
        );
        break;

      case 'mattermost':
        ws.send(
          JSON.stringify({
            event: 'hello',
            data: { server_version: '9.0.0.mock', connection_id: ws.data.id },
          }),
        );
        break;

      case 'stream':
        ws.send(
          JSON.stringify({
            type: 'health.check',
            created_at: new Date().toISOString(),
            connection_id: ws.data.id,
          }),
        );
        break;

      default:
        ws.send(
          JSON.stringify({
            type: 'convey.mock.welcome',
            clientId: ws.data.id,
            timestamp: new Date().toISOString(),
            status: 'connected',
            features: ['live_request_stream', 'webhook_receipt_stream', 'chaos_telemetry'],
          }),
        );
        break;
    }
  }

  /** Broadcast a live event to all connected inspector sockets */
  broadcastInspectorEvent(eventType: 'request' | 'webhook' | 'chaos', data: unknown): void {
    if (this.clients.size === 0) return;

    const payload = JSON.stringify({
      type: `mock.${eventType}`,
      timestamp: new Date().toISOString(),
      data,
    });

    for (const ws of this.clients) {
      if (ws.data.topic === 'inspector' || ws.data.topic === 'general') {
        try {
          ws.send(payload);
        } catch {
          // ignore send error
        }
      }
    }
  }

  /** Broadcast channel message to subscribed Pusher sockets */
  broadcastPusherChannel(channel: string, event: string, data: unknown): void {
    const payload = JSON.stringify({
      channel,
      event,
      data: JSON.stringify(data),
    });

    for (const ws of this.clients) {
      if (ws.data.topic === 'pusher' && ws.data.subscribedChannels?.has(channel)) {
        try {
          ws.send(payload);
        } catch {
          // ignore
        }
      }
    }
  }

  get totalConnected(): number {
    return this.clients.size;
  }
}

export const mockWsManager = new MockWebSocketManager();
