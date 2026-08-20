import { TimezoneResolver } from '../../utils/timezone-resolver';
import { MessagePriority } from '../messaging/messaging.types';

export interface QuietHoursEvaluation {
  inQuietHours: boolean;
  nextAllowedSendTime?: Date;
  timezone: string;
  localHour?: number;
}

export const QuietHoursEngine = {
  /**
   * Calculates the upcoming 08:00 AM UTC timestamp in the recipient's timezone.
   */
  calculateNextMorningWindow(now: Date, ianaTimezone: string, targetHour: number, isTomorrow: boolean): Date {
    const offsetHours = TimezoneResolver.getUtcOffsetHours(ianaTimezone, now);

    // Get local date components in timezone
    const dateParts = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaTimezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(now);

    const year = Number.parseInt(dateParts.find((p) => p.type === 'year')?.value || '2026', 10);
    const month = Number.parseInt(dateParts.find((p) => p.type === 'month')?.value || '1', 10) - 1;
    let day = Number.parseInt(dateParts.find((p) => p.type === 'day')?.value || '1', 10);

    if (isTomorrow) {
      day += 1;
    }

    // Local target timestamp: year, month, day, targetHour:00:00
    const localTargetMs = Date.UTC(year, month, day, targetHour, 0, 0, 0);
    // Convert back to UTC by subtracting offset
    const utcTargetMs = localTargetMs - offsetHours * 3600 * 1000;

    return new Date(utcTargetMs);
  },

  /**
   * Evaluates if a message falls within recipient quiet hours (e.g., 21:00 to 08:00 local time).
   */
  evaluate(params: {
    country?: string;
    phone?: string;
    priority?: MessagePriority;
    now?: Date;
    quietStartHour?: number; // default 21 (9 PM)
    quietEndHour?: number; // default 8 (8 AM)
  }): QuietHoursEvaluation {
    const priority = params.priority || MessagePriority.NORMAL;

    // Critical and transactional alerts always bypass quiet hours
    if (priority === MessagePriority.CRITICAL || priority === MessagePriority.TRANSACTIONAL) {
      return { inQuietHours: false, timezone: 'UTC' };
    }

    const { ianaTimezone } = TimezoneResolver.resolve(params.country, params.phone);
    const now = params.now || new Date();

    const hourFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaTimezone,
      hour: 'numeric',
      hour12: false,
    });

    const localHour = Number.parseInt(hourFormatter.format(now), 10);
    const quietStart = params.quietStartHour ?? 21;
    const quietEnd = params.quietEndHour ?? 8;

    const inQuietHours = localHour >= quietStart || localHour < quietEnd;

    if (!inQuietHours) {
      return { inQuietHours: false, timezone: ianaTimezone, localHour };
    }

    const nextAllowedSendTime = this.calculateNextMorningWindow(now, ianaTimezone, quietEnd, localHour >= quietStart);

    return {
      inQuietHours: true,
      nextAllowedSendTime,
      timezone: ianaTimezone,
      localHour,
    };
  },
};
