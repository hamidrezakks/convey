import {
  Channel,
  type PreferenceCheckResult,
  type RecipientPreferencesDto,
  type SubscriptionTopicDto,
} from '@convey/shared';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { recipientPreferences, subscriptionTopics } from '../../db/schema/preferences';
import { Rfc8058 } from './rfc8058';

export class PreferencesService {
  /**
   * Creates or updates a subscription topic.
   */
  static async createOrUpdateTopic(params: {
    tenantId: string;
    team: string;
    key: string;
    name: string;
    description?: string;
    isMandatory?: boolean;
    defaultChannels?: Channel[];
  }): Promise<SubscriptionTopicDto> {
    const { tenantId, team, key, name, description, isMandatory = false, defaultChannels = ['email'] } = params;

    const [existing] = await db
      .select()
      .from(subscriptionTopics)
      .where(
        and(
          eq(subscriptionTopics.tenantId, tenantId),
          eq(subscriptionTopics.team, team),
          eq(subscriptionTopics.key, key),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(subscriptionTopics)
        .set({
          name,
          description,
          isMandatory,
          defaultChannels,
        })
        .where(eq(subscriptionTopics.id, existing.id));

      return {
        id: existing.id,
        tenantId,
        team,
        key,
        name,
        description,
        isMandatory,
        defaultChannels: defaultChannels as Channel[],
        createdAt: existing.createdAt.toISOString(),
      };
    }

    const id = Bun.randomUUIDv7();
    await db.insert(subscriptionTopics).values({
      id,
      tenantId,
      team,
      key,
      name,
      description,
      isMandatory,
      defaultChannels,
    });

    return {
      id,
      tenantId,
      team,
      key,
      name,
      description,
      isMandatory,
      defaultChannels: defaultChannels as Channel[],
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Lists subscription topics for a tenant team.
   */
  static async listTopics(tenantId: string, team: string): Promise<SubscriptionTopicDto[]> {
    const list = await db
      .select()
      .from(subscriptionTopics)
      .where(and(eq(subscriptionTopics.tenantId, tenantId), eq(subscriptionTopics.team, team)))
      .orderBy(desc(subscriptionTopics.createdAt));

    return list.map((t) => ({
      id: t.id,
      tenantId: t.tenantId,
      team: t.team,
      key: t.key,
      name: t.name,
      description: t.description || undefined,
      isMandatory: t.isMandatory,
      defaultChannels: (t.defaultChannels as Channel[]) || ['email'],
      createdAt: t.createdAt.toISOString(),
    }));
  }

  /**
   * Upserts recipient preference record.
   */
  static async upsertPreferences(params: {
    tenantId: string;
    team: string;
    recipientId: string;
    email?: string;
    phone?: string;
    timezone?: string;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    channelPreferences?: Partial<Record<Channel, boolean>>;
    topicPreferences?: Record<string, boolean>;
  }): Promise<RecipientPreferencesDto> {
    const {
      tenantId,
      team,
      recipientId,
      email,
      phone,
      timezone = 'UTC',
      quietHoursStart,
      quietHoursEnd,
      channelPreferences = {},
      topicPreferences = {},
    } = params;

    const [existing] = await db
      .select()
      .from(recipientPreferences)
      .where(and(eq(recipientPreferences.tenantId, tenantId), eq(recipientPreferences.recipientId, recipientId)))
      .limit(1);

    const rawChannels = (existing ? (existing.channelPreferences as Record<string, boolean>) : {}) || {};
    const mergedChannels: Record<string, boolean> = {
      email: true,
      sms: true,
      push: true,
      chat: true,
      whatsapp: true,
      [Channel.EMAIL]: true,
      [Channel.SMS]: true,
      [Channel.PUSH]: true,
      [Channel.CHAT]: true,
      [Channel.WHATSAPP]: true,
      ...rawChannels,
    };

    if (channelPreferences) {
      for (const [k, v] of Object.entries(channelPreferences)) {
        if (v !== undefined) {
          mergedChannels[k] = v;
          mergedChannels[k.toLowerCase()] = v;
          mergedChannels[k.toUpperCase()] = v;
        }
      }
    }

    const mergedTopics = {
      ...(existing ? (existing.topicPreferences as Record<string, boolean>) : {}),
      ...topicPreferences,
    };

    if (existing) {
      await db
        .update(recipientPreferences)
        .set({
          email: email || existing.email,
          phone: phone || existing.phone,
          timezone,
          quietHoursStart,
          quietHoursEnd,
          channelPreferences: mergedChannels,
          topicPreferences: mergedTopics,
          updatedAt: new Date(),
        })
        .where(eq(recipientPreferences.id, existing.id));

      return {
        id: existing.id,
        tenantId,
        team,
        recipientId,
        email: email || existing.email || undefined,
        phone: phone || existing.phone || undefined,
        timezone,
        quietHoursStart: quietHoursStart || undefined,
        quietHoursEnd: quietHoursEnd || undefined,
        channelPreferences: mergedChannels as Record<Channel, boolean>,
        topicPreferences: mergedTopics,
        unsubscribeToken: existing.unsubscribeToken,
        updatedAt: new Date().toISOString(),
      };
    }

    const id = Bun.randomUUIDv7();
    const token = Rfc8058.generateToken();

    await db.insert(recipientPreferences).values({
      id,
      tenantId,
      team,
      recipientId,
      email,
      phone,
      timezone,
      quietHoursStart,
      quietHoursEnd,
      channelPreferences: mergedChannels,
      topicPreferences: mergedTopics,
      unsubscribeToken: token,
    });

    return {
      id,
      tenantId,
      team,
      recipientId,
      email,
      phone,
      timezone,
      quietHoursStart,
      quietHoursEnd,
      channelPreferences: mergedChannels as Record<Channel, boolean>,
      topicPreferences: mergedTopics,
      unsubscribeToken: token,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Retrieves preferences by recipient ID.
   */
  static async getPreferences(tenantId: string, recipientId: string): Promise<RecipientPreferencesDto | null> {
    const [record] = await db
      .select()
      .from(recipientPreferences)
      .where(and(eq(recipientPreferences.tenantId, tenantId), eq(recipientPreferences.recipientId, recipientId)))
      .limit(1);

    if (!record) return null;

    const rawChannels = (record.channelPreferences || {}) as Record<string, boolean>;
    const normalizedChannels: Record<string, boolean> = {
      ...rawChannels,
      [Channel.EMAIL]: rawChannels.email ?? rawChannels[Channel.EMAIL] ?? true,
      [Channel.SMS]: rawChannels.sms ?? rawChannels[Channel.SMS] ?? true,
      [Channel.PUSH]: rawChannels.push ?? rawChannels[Channel.PUSH] ?? true,
      [Channel.CHAT]: rawChannels.chat ?? rawChannels[Channel.CHAT] ?? true,
      [Channel.WHATSAPP]: rawChannels.whatsapp ?? rawChannels[Channel.WHATSAPP] ?? true,
      email: rawChannels.email ?? rawChannels[Channel.EMAIL] ?? true,
      sms: rawChannels.sms ?? rawChannels[Channel.SMS] ?? true,
      push: rawChannels.push ?? rawChannels[Channel.PUSH] ?? true,
      chat: rawChannels.chat ?? rawChannels[Channel.CHAT] ?? true,
      whatsapp: rawChannels.whatsapp ?? rawChannels[Channel.WHATSAPP] ?? true,
    };

    return {
      id: record.id,
      tenantId: record.tenantId,
      team: record.team,
      recipientId: record.recipientId,
      email: record.email || undefined,
      phone: record.phone || undefined,
      timezone: record.timezone,
      quietHoursStart: record.quietHoursStart || undefined,
      quietHoursEnd: record.quietHoursEnd || undefined,
      channelPreferences: normalizedChannels as Record<Channel, boolean>,
      topicPreferences: record.topicPreferences as Record<string, boolean>,
      unsubscribeToken: record.unsubscribeToken,
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  /**
   * Executes one-click unsubscribe via token.
   */
  static async handleUnsubscribe(token: string, topicKey?: string): Promise<{ success: boolean; message: string }> {
    const [pref] = await db
      .select()
      .from(recipientPreferences)
      .where(eq(recipientPreferences.unsubscribeToken, token))
      .limit(1);

    if (!pref) {
      throw new Error('Invalid or expired unsubscribe token');
    }

    if (topicKey) {
      const topics = (pref.topicPreferences as Record<string, boolean>) || {};
      topics[topicKey] = false;

      await db
        .update(recipientPreferences)
        .set({ topicPreferences: topics, updatedAt: new Date() })
        .where(eq(recipientPreferences.id, pref.id));

      return {
        success: true,
        message: `Successfully unsubscribed from topic "${topicKey}"`,
      };
    }

    // Global channel disable if no specific topic
    await db
      .update(recipientPreferences)
      .set({
        channelPreferences: { email: false, sms: false, push: false, chat: false },
        updatedAt: new Date(),
      })
      .where(eq(recipientPreferences.id, pref.id));

    return {
      success: true,
      message: 'Successfully unsubscribed from all communications',
    };
  }

  /**
   * Evaluates if a message dispatch is allowed based on user topic & channel preferences and quiet hours.
   */
  static async checkDispatchAllowed(params: {
    tenantId: string;
    recipientId: string;
    channel: Channel;
    topicKey?: string;
  }): Promise<PreferenceCheckResult> {
    const { tenantId, recipientId, channel, topicKey } = params;

    const pref = await PreferencesService.getPreferences(tenantId, recipientId);
    if (!pref) {
      return { allowed: true };
    }

    // 1. Check channel level
    const chLower = String(channel).toLowerCase();
    const chUpper = String(channel).toUpperCase();
    const isChannelDisabled =
      pref.channelPreferences[channel] === false ||
      pref.channelPreferences[chLower as Channel] === false ||
      pref.channelPreferences[chUpper as Channel] === false;

    if (isChannelDisabled) {
      return { allowed: false, reason: 'DISABLED_CHANNEL' };
    }

    // 2. Check topic level
    if (topicKey) {
      const topicOpt = pref.topicPreferences[topicKey];
      if (topicOpt === false) {
        // Verify if topic is mandatory
        const [topic] = await db
          .select()
          .from(subscriptionTopics)
          .where(and(eq(subscriptionTopics.tenantId, tenantId), eq(subscriptionTopics.key, topicKey)))
          .limit(1);

        if (!topic?.isMandatory) {
          return { allowed: false, reason: 'OPTED_OUT_TOPIC' };
        }
      }
    }

    // 3. Check quiet hours
    if (pref.quietHoursStart && pref.quietHoursEnd) {
      const isQuiet = PreferencesService.isInsideQuietHours(pref.quietHoursStart, pref.quietHoursEnd, pref.timezone);

      if (isQuiet) {
        return { allowed: false, reason: 'IN_QUIET_HOURS' };
      }
    }

    return { allowed: true };
  }

  /**
   * Computes whether the current moment in a timezone falls inside quiet hours.
   */
  static isInsideQuietHours(start: string, end: string, timezone = 'UTC'): boolean {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const parts = formatter.formatToParts(now);
      const hour = Number.parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
      const minute = Number.parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
      const currentMinutes = hour * 60 + minute;

      const [startHour, startMin] = start.split(':').map(Number);
      const [endHour, endMin] = end.split(':').map(Number);

      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (startMinutes > endMinutes) {
        // Spans midnight (e.g. 22:00 -> 08:00)
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } catch {
      return false;
    }
  }
}
