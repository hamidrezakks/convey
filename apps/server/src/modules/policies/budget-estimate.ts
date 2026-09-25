import type { ProviderSendOptions } from '../providers/core/provider-types';

// GSM 03.38 default and extension alphabets; extended characters consume two septets.
const GSM = new Set(
  Array.from(
    '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
  ),
);
const EXTENDED = new Set(Array.from('\f^{}\\[~]|€'));
function segments(widths: number[], single: number, multipart: number): number {
  if (widths.reduce((sum, width) => sum + width, 0) <= single) return 1;
  let count = 1;
  let used = 0;
  for (const width of widths) {
    if (used + width > multipart) {
      count++;
      used = 0;
    }
    used += width;
  }
  return count;
}
export function estimateBudgetUnits(options: ProviderSendOptions): number {
  const recipient = options.recipient;
  const targets =
    recipient.phone ??
    recipient.email ??
    recipient.to ??
    recipient.fcmTokens ??
    recipient.apnsTokens ??
    recipient.deviceTokens;
  const recipients = Array.isArray(targets) ? Math.max(1, targets.length) : 1;
  if (options.channel !== 'sms') return recipients;
  const text = String(options.content.text ?? options.content.body ?? options.content.title ?? '');
  const characters = Array.from(text);
  if (characters.every((character) => GSM.has(character) || EXTENDED.has(character)))
    return (
      recipients *
      segments(
        characters.map((character) => (EXTENDED.has(character) ? 2 : 1)),
        160,
        153,
      )
    );
  return (
    recipients *
    segments(
      characters.map((character) => character.length),
      70,
      67,
    )
  );
}
