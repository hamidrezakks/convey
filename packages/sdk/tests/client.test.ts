import { describe, expect, it } from 'bun:test';
import { Convey, ConveyClient, ConveyConfigurationError, ConveyEnvironment } from '../src';

describe('Convey Client Initialization', () => {
  it('should instantiate successfully with a valid API key and baseUrl', () => {
    const client = new Convey({ apiKey: 'sk_live_12345', baseUrl: 'http://localhost:3000' });
    expect(client).toBeInstanceOf(Convey);
    expect(client).toBeInstanceOf(ConveyClient);
    expect(client.http.apiKey).toBe('sk_live_12345');
    expect(client.http.baseUrl).toBe('http://localhost:3000');
    expect(client.baseUrl).toBe('http://localhost:3000');
    expect(client.getBaseUrl()).toBe('http://localhost:3000');
    expect(client.http.timeoutMs).toBe(10000);
    expect(client.http.maxRetries).toBe(3);
    expect(client.http.isSandbox).toBe(false);
  });

  it('should throw ConveyConfigurationError when baseUrl is missing and no env var is set', () => {
    const prevEnv = process.env.CONVEY_BASE_URL;
    delete process.env.CONVEY_BASE_URL;
    try {
      expect(() => new Convey({ apiKey: 'sk_live_123' })).toThrow(ConveyConfigurationError);
    } finally {
      if (prevEnv) process.env.CONVEY_BASE_URL = prevEnv;
    }
  });

  it('should instantiate successfully using environment preset', () => {
    const client = new Convey({ apiKey: 'sk_live_123', environment: ConveyEnvironment.US });
    expect(client.baseUrl).toBe('https://us.api.convey.dev');

    const clientEu = new Convey({ apiKey: 'sk_live_123', environment: 'eu' });
    expect(clientEu.baseUrl).toBe('https://eu.api.convey.dev');
  });

  it('should allow dynamic baseUrl update via setBaseUrl()', () => {
    const client = new Convey({ apiKey: 'sk_live_123', baseUrl: 'http://localhost:3000' });
    expect(client.baseUrl).toBe('http://localhost:3000');

    client.setBaseUrl('https://api.convey.dev/');
    expect(client.baseUrl).toBe('https://api.convey.dev');
    expect(client.getBaseUrl()).toBe('https://api.convey.dev');
  });

  it('should throw error when apiKey is empty', () => {
    const prevKey = process.env.CONVEY_API_KEY;
    delete process.env.CONVEY_API_KEY;
    try {
      expect(() => new Convey({ apiKey: '', baseUrl: 'http://localhost:3000' })).toThrow('requires a valid apiKey');
    } finally {
      if (prevKey) process.env.CONVEY_API_KEY = prevKey;
    }
  });

  it('should detect sandbox mode automatically from test keys', () => {
    const client = new Convey({ apiKey: 'sk_test_98765', baseUrl: 'http://localhost:3000' });
    expect(client.http.isSandbox).toBe(true);
  });

  it('should respect explicit isSandbox: true option', () => {
    const client = new Convey({ apiKey: 'sk_live_12345', isSandbox: true, baseUrl: 'http://localhost:3000' });
    expect(client.http.isSandbox).toBe(true);
  });

  it('should support client scoping with withTeam() and withOptions()', () => {
    const client = new Convey({ apiKey: 'sk_live_custom', baseUrl: 'https://convey.mycorp.internal' });
    const scoped = client.withTeam('team_marketing');
    expect(scoped.http.teamId).toBe('team_marketing');
    expect(scoped.baseUrl).toBe('https://convey.mycorp.internal');

    const overridden = client.withOptions({ timeoutMs: 5000, isSandbox: true });
    expect(overridden.http.timeoutMs).toBe(5000);
    expect(overridden.http.isSandbox).toBe(true);
  });

  it('should expose all expected resource namespaces', () => {
    const client = new Convey({ apiKey: 'sk_live_123', baseUrl: 'http://localhost:3000' });
    expect(client.messages).toBeDefined();
    expect(client.batches).toBeDefined();
    expect(client.suppressions).toBeDefined();
    expect(client.webhooks).toBeDefined();
    expect(client.webhooks.subscriptions).toBeDefined();
    expect(client.dlq).toBeDefined();
    expect(client.sandbox).toBeDefined();
    expect(client.reports).toBeDefined();
    expect(client.admin).toBeDefined();
    expect(client.templates).toBeDefined();
    expect(client.preferences).toBeDefined();
    expect(client.inbox).toBeDefined();
  });

  it('should export all domain enums as runtime values', async () => {
    const {
      BatchState,
      Channel,
      CircuitState,
      DlqFailureCategory,
      MessagePriority,
      MessageStatus,
      SuppressionReason,
      UserRole,
    } = await import('../src');

    expect(Channel.EMAIL).toBe(Channel.EMAIL);
    expect(String(Channel.EMAIL)).toBe('EMAIL');
    expect(String(Channel.SMS)).toBe('SMS');
    expect(String(Channel.WHATSAPP)).toBe('WHATSAPP');
    expect(String(Channel.SLACK)).toBe('SLACK');
    expect(String(Channel.PUSH)).toBe('PUSH');

    expect(String(MessagePriority.CRITICAL)).toBe('CRITICAL');
    expect(String(MessagePriority.HIGH)).toBe('HIGH');
    expect(String(MessagePriority.DEFAULT)).toBe('DEFAULT');
    expect(String(MessagePriority.LOW)).toBe('LOW');

    expect(String(MessageStatus.ACCEPTED)).toBe('ACCEPTED');
    expect(String(MessageStatus.DELIVERED)).toBe('DELIVERED');
    expect(String(MessageStatus.FAILED)).toBe('FAILED');

    expect(String(CircuitState.CLOSED)).toBe('CLOSED');
    expect(String(CircuitState.HALF_OPEN)).toBe('HALF_OPEN');
    expect(String(CircuitState.OPEN)).toBe('OPEN');

    expect(String(SuppressionReason.HARD_BOUNCE)).toBe('HARD_BOUNCE');
    expect(String(SuppressionReason.SPAM_COMPLAINT)).toBe('SPAM_COMPLAINT');

    expect(String(DlqFailureCategory.PROVIDER_5XX)).toBe('PROVIDER_5XX');
    expect(String(DlqFailureCategory.RATE_LIMIT_429)).toBe('RATE_LIMIT_429');

    expect(String(UserRole.ORG_ADMIN)).toBe('ORG_ADMIN');
    expect(String(BatchState.PROCESSING)).toBe('PROCESSING');
  });
});
