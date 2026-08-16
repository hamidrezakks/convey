import { IdentifierType } from '../modules/messaging/messaging.types';

export interface RecipientOptions {
  email?: string;
  phone?: string;
  whatsapp?: string;
  [key: string]: unknown;
}

export function extractRecipientIdentifiers(
  recipients?: RecipientOptions,
): Array<{ type: IdentifierType; raw?: string }> {
  if (!recipients) return [];
  return [
    { type: IdentifierType.EMAIL, raw: recipients.email },
    { type: IdentifierType.PHONE, raw: recipients.phone },
    { type: IdentifierType.WHATSAPP, raw: recipients.whatsapp },
  ];
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
