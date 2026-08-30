import { describe, expect, it } from 'bun:test';
import { generateProviderId } from '../src/core/id-generator';
import { mockLogger } from '../src/core/logger';

describe('Core Engine & ID Generator', () => {
  it('generates authentic Resend message IDs starting with re_', () => {
    const id = generateProviderId('resend');
    expect(id).toMatch(/^re_[0-9a-zA-Z_-]{24,}$/);
  });

  it('generates authentic Twilio SIDs starting with SM', () => {
    const id = generateProviderId('twilio');
    expect(id).toMatch(/^SM[0-9a-fA-F]{32}$/);
  });

  it('generates authentic Slack timestamps', () => {
    const ts = generateProviderId('slack');
    expect(ts).toMatch(/^\d{10}\.\d{6}$/);
  });

  it('generates authentic SendGrid message IDs', () => {
    const id = generateProviderId('sendgrid');
    expect(id).toMatch(/^SG\.[0-9a-zA-Z_-]{22}\.[0-9a-zA-Z_-]{22}$/);
  });

  it('generates authentic FCM message names', () => {
    const id = generateProviderId('fcm', { projectId: 'my-project' });
    expect(id).toContain('projects/my-project/messages/');
  });

  it('formats structured box logs without throwing', () => {
    const logOutput = mockLogger.formatRequestBox({
      providerId: 'resend',
      method: 'POST',
      url: '/emails',
      status: 200,
      latencyMs: 1.5,
      auth: 'Bearer re_test_key***',
      recipient: 'user@example.com',
      from: 'sender@convey.dev',
      subject: 'Test Email',
      messageId: 're_1234567890',
    });
    expect(logOutput).toContain('[MOCK-RESEND]');
    expect(logOutput).toContain('200 OK');
    expect(logOutput).toContain('user@example.com');
  });
});
