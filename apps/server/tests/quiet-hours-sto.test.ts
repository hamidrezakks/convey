import { describe, expect, it } from 'bun:test';
import { MessagePriority } from '../src/modules/messaging/messaging.types';
import { QuietHoursEngine } from '../src/modules/policies/quiet-hours';
import { TimezoneResolver } from '../src/utils/timezone-resolver';

describe('Timezone-Aware Quiet Hours & Send-Time Optimization (STO) Suite', () => {
  it('resolves North American (+1) numbers to America/New_York', () => {
    const res = TimezoneResolver.resolve('US', '+14155552671');
    expect(res.ianaTimezone).toBe('America/New_York');
    expect(res.country).toBe('US');
  });

  it('resolves UAE (+971) numbers to Asia/Dubai', () => {
    const res = TimezoneResolver.resolve('AE', '+971501234567');
    expect(res.ianaTimezone).toBe('Asia/Dubai');
    expect(res.country).toBe('AE');
  });

  it('resolves UK (+44) numbers to Europe/London', () => {
    const res = TimezoneResolver.resolve('GB', '+447911123456');
    expect(res.ianaTimezone).toBe('Europe/London');
    expect(res.country).toBe('GB');
  });

  it('resolves Japan (+81) numbers to Asia/Tokyo', () => {
    const res = TimezoneResolver.resolve('JP', '+81312345678');
    expect(res.ianaTimezone).toBe('Asia/Tokyo');
    expect(res.country).toBe('JP');
  });

  it('resolves India (+91) numbers to Asia/Kolkata with +5.5 offset', () => {
    const res = TimezoneResolver.resolve('IN', '+919876543210');
    expect(res.ianaTimezone).toBe('Asia/Kolkata');
    expect(res.country).toBe('IN');
  });

  it('resolves Australia (+61) numbers to Australia/Sydney', () => {
    const res = TimezoneResolver.resolve('AU', '+61412345678');
    expect(res.ianaTimezone).toBe('Australia/Sydney');
    expect(res.country).toBe('AU');
  });

  it('resolves Brazil (+55) numbers to America/Sao_Paulo', () => {
    const res = TimezoneResolver.resolve('BR', '+5511912345678');
    expect(res.ianaTimezone).toBe('America/Sao_Paulo');
    expect(res.country).toBe('BR');
  });

  it('resolves Egypt (+20) numbers to Africa/Cairo', () => {
    const res = TimezoneResolver.resolve('EG', '+201012345678');
    expect(res.ianaTimezone).toBe('Africa/Cairo');
    expect(res.country).toBe('EG');
  });

  it('unknown country and dial code defaults to US (America/New_York)', () => {
    const res = TimezoneResolver.resolve('UNKNOWN_CODE', undefined);
    expect(res.country).toBe('US');
    expect(res.ianaTimezone).toBe('America/New_York');
  });

  it('daytime marketing notification (14:00 local) evaluates to inQuietHours: false', () => {
    const daytime = new Date('2026-08-14T14:00:00Z');
    const evalRes = QuietHoursEngine.evaluate({
      country: 'GB',
      priority: MessagePriority.MARKETING,
      now: daytime,
    });
    expect(evalRes.inQuietHours).toBe(false);
    expect(evalRes.nextAllowedSendTime).toBeUndefined();
  });

  it('late night notification (22:00 local) evaluates to inQuietHours: true', () => {
    const night = new Date('2026-08-14T22:00:00Z');
    const evalRes = QuietHoursEngine.evaluate({
      country: 'GB',
      priority: MessagePriority.MARKETING,
      now: night,
    });
    expect(evalRes.inQuietHours).toBe(true);
    expect(evalRes.nextAllowedSendTime).toBeDefined();
  });

  it('early morning notification (05:00 local) evaluates to inQuietHours: true', () => {
    const earlyMorning = new Date('2026-08-14T05:00:00Z');
    const evalRes = QuietHoursEngine.evaluate({
      country: 'GB',
      priority: MessagePriority.MARKETING,
      now: earlyMorning,
    });
    expect(evalRes.inQuietHours).toBe(true);
    expect(evalRes.nextAllowedSendTime).toBeDefined();
  });

  it('exact quiet hours start boundary (21:00 local) evaluates to inQuietHours: true', () => {
    const boundaryStart = new Date('2026-08-14T21:00:00Z');
    const evalRes = QuietHoursEngine.evaluate({
      country: 'GB',
      priority: MessagePriority.MARKETING,
      now: boundaryStart,
    });
    expect(evalRes.inQuietHours).toBe(true);
  });

  it('exact quiet hours end boundary (08:00 local) evaluates to inQuietHours: false', () => {
    const boundaryEnd = new Date('2026-08-14T07:00:00Z'); // 08:00 BST
    const evalRes = QuietHoursEngine.evaluate({
      country: 'GB',
      priority: MessagePriority.MARKETING,
      now: boundaryEnd,
    });
    expect(evalRes.inQuietHours).toBe(false);
  });

  it('one minute before morning window (07:59 local) evaluates to inQuietHours: true', () => {
    const justBeforeMorning = new Date('2026-08-14T06:59:00Z'); // 07:59 BST
    const evalRes = QuietHoursEngine.evaluate({
      country: 'GB',
      priority: MessagePriority.MARKETING,
      now: justBeforeMorning,
    });
    expect(evalRes.inQuietHours).toBe(true);
  });

  it('calculates 08:00 AM on following day for late evening notification', () => {
    const nightLondon = new Date('2026-08-14T23:00:00Z');
    const evalRes = QuietHoursEngine.evaluate({
      country: 'GB',
      priority: MessagePriority.MARKETING,
      now: nightLondon,
    });
    expect(evalRes.nextAllowedSendTime).toBeDefined();
    const nextTime = evalRes.nextAllowedSendTime as Date;
    expect(nextTime.getTime()).toBeGreaterThan(nightLondon.getTime());
  });

  it('calculates 08:00 AM on same day for early morning notification', () => {
    const earlyMorningLondon = new Date('2026-08-14T03:00:00Z');
    const evalRes = QuietHoursEngine.evaluate({
      country: 'GB',
      priority: MessagePriority.MARKETING,
      now: earlyMorningLondon,
    });
    expect(evalRes.nextAllowedSendTime).toBeDefined();
    const nextTime = evalRes.nextAllowedSendTime as Date;
    expect(nextTime.getTime()).toBeGreaterThan(earlyMorningLondon.getTime());
  });

  it('CRITICAL priority immediately bypasses quiet hours', () => {
    const midnight = new Date('2026-08-14T00:00:00Z');
    const evalRes = QuietHoursEngine.evaluate({
      country: 'GB',
      priority: MessagePriority.CRITICAL,
      now: midnight,
    });
    expect(evalRes.inQuietHours).toBe(false);
  });

  it('TRANSACTIONAL priority immediately bypasses quiet hours', () => {
    const midnight = new Date('2026-08-14T00:00:00Z');
    const evalRes = QuietHoursEngine.evaluate({
      country: 'GB',
      priority: MessagePriority.TRANSACTIONAL,
      now: midnight,
    });
    expect(evalRes.inQuietHours).toBe(false);
  });

  it('year-end boundary (Dec 31 23:00) rolls over to Jan 1 08:00 AM of next year', () => {
    const newYearsEve = new Date('2026-12-31T23:00:00Z');
    const nextWindow = QuietHoursEngine.calculateNextMorningWindow(newYearsEve, 'Europe/London', 8, true);
    expect(nextWindow.getUTCFullYear()).toBe(2027);
    expect(nextWindow.getUTCMonth()).toBe(0); // January
    expect(nextWindow.getUTCDate()).toBe(1);
  });
});
