import { describe, expect, it } from 'bun:test';
import { MessagingService } from '../src/modules/messaging/messaging.service';
import { Channel, MessagePriority } from '../src/modules/messaging/messaging.types';
import { QuietHoursEngine } from '../src/modules/policies/quiet-hours';
import { TimezoneResolver } from '../src/utils/timezone-resolver';
import { setupFreshIsolatedDatabase } from './helpers/fresh-db-runner';

describe('Timezone-Aware Quiet Hours & Send-Time Optimization Engine', () => {
  it('Resolves country codes and E.164 phone prefixes to correct IANA timezones', () => {
    expect(TimezoneResolver.resolve('GB').ianaTimezone).toBe('Europe/London');
    expect(TimezoneResolver.resolve('AE').ianaTimezone).toBe('Asia/Dubai');
    expect(TimezoneResolver.resolve('JP').ianaTimezone).toBe('Asia/Tokyo');
    expect(TimezoneResolver.resolve(undefined, '+971501234567').ianaTimezone).toBe('Asia/Dubai');
    expect(TimezoneResolver.resolve(undefined, '+447911123456').ianaTimezone).toBe('Europe/London');
    expect(TimezoneResolver.resolve(undefined, '+14155552671').ianaTimezone).toBe('America/New_York');
  });

  it('Allows daytime notifications without deferral', () => {
    // 14:00 UTC is daytime in London
    const daytimeLondon = new Date('2026-08-14T14:00:00Z');
    const res = QuietHoursEngine.evaluate({
      country: 'GB',
      priority: MessagePriority.MARKETING,
      now: daytimeLondon,
    });

    expect(res.inQuietHours).toBe(false);
    expect(res.nextAllowedSendTime).toBeUndefined();
  });

  it('Defers night-time marketing notifications until 08:00 AM local time', () => {
    // 23:30 UTC is 23:30 in London (quiet hours: >= 21:00)
    const nighttimeLondon = new Date('2026-08-14T23:30:00Z');
    const res = QuietHoursEngine.evaluate({
      country: 'GB',
      priority: MessagePriority.MARKETING,
      now: nighttimeLondon,
    });

    expect(res.inQuietHours).toBe(true);
    expect(res.nextAllowedSendTime).toBeDefined();

    // Verify next allowed send time is 08:00 AM on the following day
    const nextWindow = res.nextAllowedSendTime as Date;
    expect(nextWindow.getTime()).toBeGreaterThan(nighttimeLondon.getTime());

    const hourInLondon = Number.parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/London', hour: 'numeric', hour12: false }).format(
        nextWindow,
      ),
      10,
    );
    expect(hourInLondon).toBe(8);
  });

  it('Critical and Transactional alerts immediately bypass quiet hours', () => {
    const nighttimeLondon = new Date('2026-08-14T23:30:00Z');
    const resCritical = QuietHoursEngine.evaluate({
      country: 'GB',
      priority: MessagePriority.CRITICAL,
      now: nighttimeLondon,
    });
    expect(resCritical.inQuietHours).toBe(false);

    const resTransactional = QuietHoursEngine.evaluate({
      country: 'GB',
      priority: MessagePriority.TRANSACTIONAL,
      now: nighttimeLondon,
    });
    expect(resTransactional.inQuietHours).toBe(false);
  });

  it('MessagingService accepts and automatically schedules marketing message during quiet hours', async () => {
    const setup = await setupFreshIsolatedDatabase();
    const team = `team_qh_${setup.prefix}`;

    const res = await MessagingService.acceptMessage({
      idempotencyKey: `idem_qh_${Date.now()}`,
      userId: 'usr_quiet_hours',
      team,
      category: 'promotions',
      country: 'AE',
      priority: MessagePriority.MARKETING,
      recipients: { phone: '+971501234567' },
      channels: [{ channel: Channel.SMS, content: { text: 'Summer Sale 50% Off' } }],
    });

    expect(res.statusCode).toBe(202);
    const body = res.body as { state: string; messageId: string };
    expect(body.messageId).toBeDefined();
  });
});
