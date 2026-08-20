import { Channel, IdentifierType } from '../modules/messaging/messaging.types';

export interface RecipientOptions {
  email?: string;
  phone?: string;
  whatsapp?: string;
  telegramChatId?: string;
  slack?: { channelId: string };
  fcmTokens?: string[];
  apnsTokens?: string[];
  [key: string]: unknown;
}

/**
 * Resolves the channel-appropriate destination/display string for a message.
 * Falls back to available recipient handles or userId if primary handle is not present.
 */
export function formatRecipientDisplay(
  recipients?: RecipientOptions | null,
  channel?: Channel | string | null,
  userId?: string | null,
): string {
  if (!recipients) {
    return userId || 'Unknown';
  }

  const normalizedChannel = (typeof channel === 'string' ? channel.toLowerCase() : channel) as Channel | undefined;

  switch (normalizedChannel) {
    case Channel.EMAIL:
      if (recipients.email) return recipients.email;
      break;

    case Channel.SMS:
      if (recipients.phone) return recipients.phone;
      break;

    case Channel.WHATSAPP:
      if (recipients.whatsapp) return recipients.whatsapp;
      if (recipients.phone) return recipients.phone;
      break;

    case Channel.TELEGRAM:
      if (recipients.telegramChatId) return recipients.telegramChatId;
      if (recipients.phone) return recipients.phone;
      break;

    case Channel.SLACK:
      if (recipients.slack?.channelId) return recipients.slack.channelId;
      break;

    case Channel.FCM:
      if (Array.isArray(recipients.fcmTokens) && recipients.fcmTokens.length > 0) {
        return recipients.fcmTokens[0];
      }
      break;

    case Channel.APNS:
      if (Array.isArray(recipients.apnsTokens) && recipients.apnsTokens.length > 0) {
        return recipients.apnsTokens[0];
      }
      break;

    case Channel.PUSH:
      if (Array.isArray(recipients.fcmTokens) && recipients.fcmTokens.length > 0) {
        return recipients.fcmTokens[0];
      }
      if (Array.isArray(recipients.apnsTokens) && recipients.apnsTokens.length > 0) {
        return recipients.apnsTokens[0];
      }
      break;

    case Channel.CHAT:
      if (recipients.whatsapp) return recipients.whatsapp;
      if (recipients.phone) return recipients.phone;
      if (recipients.telegramChatId) return recipients.telegramChatId;
      break;

    case Channel.TOOL:
      if (userId) return userId;
      break;
  }

  // Fallback in order of presence
  if (recipients.email) return recipients.email;
  if (recipients.phone) return recipients.phone;
  if (recipients.whatsapp) return recipients.whatsapp;
  if (recipients.telegramChatId) return recipients.telegramChatId;
  if (recipients.slack?.channelId) return recipients.slack.channelId;
  if (Array.isArray(recipients.fcmTokens) && recipients.fcmTokens.length > 0) return recipients.fcmTokens[0];
  if (Array.isArray(recipients.apnsTokens) && recipients.apnsTokens.length > 0) return recipients.apnsTokens[0];
  if (userId) return userId;

  return 'Unknown';
}

export function extractRecipientIdentifiers(
  recipients?: RecipientOptions | null,
  userId?: string | null,
): Array<{ type: IdentifierType; raw: string }> {
  if (!recipients && !userId) return [];
  const list: Array<{ type: IdentifierType; raw: string }> = [];

  if (recipients?.email) {
    list.push({ type: IdentifierType.EMAIL, raw: recipients.email });
  }
  if (recipients?.phone) {
    list.push({ type: IdentifierType.PHONE, raw: recipients.phone });
  }
  if (recipients?.whatsapp) {
    list.push({ type: IdentifierType.WHATSAPP, raw: recipients.whatsapp });
  }
  if (recipients?.telegramChatId) {
    list.push({ type: IdentifierType.TELEGRAM, raw: recipients.telegramChatId });
  }
  if (recipients?.slack?.channelId) {
    list.push({ type: IdentifierType.SLACK, raw: recipients.slack.channelId });
  }
  if (Array.isArray(recipients?.fcmTokens)) {
    for (const token of recipients.fcmTokens) {
      if (token) list.push({ type: IdentifierType.PUSH, raw: token });
    }
  }
  if (Array.isArray(recipients?.apnsTokens)) {
    for (const token of recipients.apnsTokens) {
      if (token) list.push({ type: IdentifierType.PUSH, raw: token });
    }
  }
  if (userId) {
    list.push({ type: IdentifierType.USER_ID, raw: userId });
  }

  return list;
}

export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/^whatsapp:/i, '').trim();
  cleaned = cleaned.replace(/[^\d+]/g, '');
  if (cleaned && !cleaned.startsWith('+')) {
    cleaned = `+${cleaned}`;
  }
  return cleaned;
}

export function normalizeIdentifier(identifier: string, type?: string): string {
  if (!identifier) return '';
  const trimmed = identifier.trim();
  if (type === 'phone' || type === 'whatsapp' || (!type && !trimmed.includes('@'))) {
    return normalizePhoneNumber(trimmed);
  }
  return trimmed.toLowerCase();
}
