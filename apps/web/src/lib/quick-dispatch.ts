export const dispatchChannels = ['email', 'sms', 'whatsapp', 'fcm', 'apns', 'slack', 'telegram'] as const;
export type DispatchChannel = (typeof dispatchChannels)[number];

export function buildQuickDispatch(
  team: string,
  channel: DispatchChannel,
  recipient: string,
  title: string,
  text: string,
) {
  const recipients = {
    email: { email: recipient },
    sms: { phone: recipient },
    whatsapp: { whatsapp: recipient },
    fcm: { fcmTokens: [recipient] },
    apns: { apnsTokens: [recipient] },
    slack: { slack: { channelId: recipient } },
    telegram: { telegramChatId: recipient },
  }[channel];
  const content =
    channel === 'fcm' || channel === 'apns'
      ? { title, body: text }
      : channel === 'email'
        ? { subject: title, text }
        : { text };
  return {
    team,
    userId: 'console-operator',
    category: 'transactional',
    country: 'US',
    idempotencyKey: crypto.randomUUID(),
    priority: 'normal',
    recipients,
    channels: [{ channel, content }],
  };
}
