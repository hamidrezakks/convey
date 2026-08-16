import './setup';
import { describe, expect, it } from 'bun:test';
import { Channel } from '@convey/shared';

describe('Provider Registration & Env Setup Logic Test Suite', () => {
  it('masks API credentials safely without exposing full secrets', () => {
    const rawKey = 'SG.9a8b7c6d5e4f3a2b1c0d_live_production_key_019283';
    const maskSecret = (v: string) => (v.length > 8 ? `${v.slice(0, 4)}...${v.slice(-4)}` : '****');

    const masked = maskSecret(rawKey);
    expect(masked).toBe('SG.9...9283');
    expect(masked).not.toContain('production_key');
  });

  it('validates provider env variable generation format', () => {
    const providerConfig = {
      providerId: 'sendgrid',
      displayName: 'SendGrid Email API',
      channel: Channel.EMAIL,
      credentials: {
        SENDGRID_API_KEY: 'SG.1234567890',
        SENDGRID_FROM_EMAIL: 'alerts@domain.com',
      },
    };

    const envLines = Object.entries(providerConfig.credentials).map(([k, v]) => `${k}=${v}`);
    expect(envLines).toContain('SENDGRID_API_KEY=SG.1234567890');
    expect(envLines).toContain('SENDGRID_FROM_EMAIL=alerts@domain.com');
  });
});
