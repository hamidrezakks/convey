import {
  Channel,
  FallbackEvent,
  MessagePriority,
  type SendMessageRequest,
  TelegramParseMode,
} from '../../src/modules/messaging/messaging.types';

export const REALISTIC_TEAMS = ['payments', 'orders', 'marketing', 'security', 'billing', 'support', 'growth', 'auth'];
export const REALISTIC_CATEGORIES = [
  'otp',
  'transactional',
  'marketing',
  'alert',
  'notification',
  'security_verification',
];
export const REALISTIC_COUNTRIES = ['AE', 'US', 'GB', 'DE', 'FR', 'IN', 'SA', 'BR', 'JP', 'CA'];
export const REALISTIC_PRIORITIES: MessagePriority[] = [
  MessagePriority.CRITICAL,
  MessagePriority.TRANSACTIONAL,
  MessagePriority.NORMAL,
  MessagePriority.MARKETING,
];

const PHONE_MAP: Record<string, string[]> = {
  AE: ['+971501234567', '+971529876543', '+971554321098'],
  US: ['+14155552671', '+12125550199', '+13125550143'],
  GB: ['+447911123456', '+447700900123', '+447890123456'],
  DE: ['+4915123456789', '+491709876543', '+491601234567'],
  FR: ['+33612345678', '+33798765432', '+33654321098'],
  IN: ['+919876543210', '+919123456789', '+919988776655'],
  SA: ['+966501234567', '+966559876543', '+966543210987'],
  BR: ['+5511987654321', '+5521998765432', '+5531987654321'],
  JP: ['+819012345678', '+818098765432', '+817012345678'],
  CA: ['+14165550192', '+16045550183', '+15145550174'],
};

const EMAILS = [
  'alex.dev@example.com',
  'sarah.ops@techcorp.io',
  'michael.admin@fintech.ae',
  'emma.user@global.org',
  'david.support@service.net',
];

export function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateRealisticSendMessageRequest(scenarioIndex: number): SendMessageRequest {
  const country = REALISTIC_COUNTRIES[scenarioIndex % REALISTIC_COUNTRIES.length];
  const team = REALISTIC_TEAMS[scenarioIndex % REALISTIC_TEAMS.length];
  const category = REALISTIC_CATEGORIES[scenarioIndex % REALISTIC_CATEGORIES.length];
  const priority = REALISTIC_PRIORITIES[scenarioIndex % REALISTIC_PRIORITIES.length];
  const phoneList = PHONE_MAP[country] || PHONE_MAP.US;
  const phone = phoneList[scenarioIndex % phoneList.length];
  const email = EMAILS[scenarioIndex % EMAILS.length];

  const channelTypes: Channel[] = [
    Channel.EMAIL,
    Channel.SMS,
    Channel.WHATSAPP,
    Channel.TELEGRAM,
    Channel.SLACK,
    Channel.FCM,
    Channel.APNS,
  ];
  const selectedChannel = channelTypes[scenarioIndex % channelTypes.length];

  const request: SendMessageRequest = {
    idempotencyKey: `scen_${scenarioIndex}_idemp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: `usr_scen_${(scenarioIndex % 100) + 1}`,
    team,
    category,
    country,
    campaignId: scenarioIndex % 3 === 0 ? `campaign_scen_${(scenarioIndex % 10) + 1}` : undefined,
    priority,
    recipients: {
      email: selectedChannel === Channel.EMAIL ? email : undefined,
      phone: selectedChannel === Channel.SMS || selectedChannel === Channel.WHATSAPP ? phone : undefined,
      whatsapp: selectedChannel === Channel.WHATSAPP ? phone : undefined,
      telegramChatId: selectedChannel === Channel.TELEGRAM ? `chat_${1000 + scenarioIndex}` : undefined,
      slack: selectedChannel === Channel.SLACK ? { channelId: `C0${1000 + scenarioIndex}` } : undefined,
      fcmTokens: selectedChannel === Channel.FCM ? [`fcm_token_scen_${scenarioIndex}`] : undefined,
      apnsTokens: selectedChannel === Channel.APNS ? [`apns_token_scen_${scenarioIndex}`] : undefined,
    },
    channels: [],
    metadata: {
      scenarioIndex,
      environment: 'e2e_test',
      traceId: `trc_${Date.now()}_${scenarioIndex}`,
    },
  };

  switch (selectedChannel) {
    case Channel.EMAIL:
      request.channels.push({
        channel: Channel.EMAIL,
        content:
          scenarioIndex % 2 === 0
            ? {
                subject: `Account Alert #${scenarioIndex}`,
                html: `<h1>Security Notification</h1><p>Action required for scenario ${scenarioIndex}.</p>`,
                text: `Security Notification: Action required for scenario ${scenarioIndex}.`,
              }
            : {
                subject: `Template Email #${scenarioIndex}`,
                render: {
                  template: 'account-welcome',
                  version: 'v1',
                  locale: 'en',
                  props: { userName: 'Valued Customer', index: scenarioIndex },
                },
              },
      });
      break;

    case Channel.SMS:
      request.channels.push({
        channel: Channel.SMS,
        content: {
          text: `Convey Verification Code: ${100000 + (scenarioIndex % 900000)}. Do not share.`,
        },
      });
      break;

    case Channel.WHATSAPP:
      request.channels.push({
        channel: Channel.WHATSAPP,
        content:
          scenarioIndex % 2 === 0
            ? { text: `Your order #${9000 + scenarioIndex} has been confirmed.` }
            : {
                template: 'order_update',
                language: 'en',
                variables: { orderId: `ORD-${9000 + scenarioIndex}`, amount: '$49.99' },
              },
      });
      break;

    case Channel.TELEGRAM:
      request.channels.push({
        channel: Channel.TELEGRAM,
        content: {
          text: `<b>System Alert</b>: CPU usage high for node ${scenarioIndex}.`,
          parseMode: TelegramParseMode.HTML,
        },
      });
      break;

    case Channel.SLACK:
      request.channels.push({
        channel: Channel.SLACK,
        content: {
          text: `New deployment completed for service convey-${scenarioIndex}`,
        },
      });
      break;

    case Channel.FCM:
      request.channels.push({
        channel: Channel.FCM,
        content: {
          title: 'New Message',
          body: `You received a new notification in scenario ${scenarioIndex}`,
          data: { type: 'chat_message', id: `msg_${scenarioIndex}` },
        },
      });
      break;

    case Channel.APNS:
      request.channels.push({
        channel: Channel.APNS,
        content: {
          title: 'iOS Security Alert',
          body: `Login attempt detected from location #${scenarioIndex}`,
          badge: 1,
          sound: 'default',
        },
      });
      break;
  }

  // Add Fallback rule to ~20% of requests
  if (scenarioIndex % 5 === 0 && selectedChannel !== Channel.SMS) {
    request.recipients.phone = phone;
    request.fallback = {
      rules: [
        {
          when: { channel: selectedChannel, event: FallbackEvent.FAILED },
          send: [{ channel: Channel.SMS, content: { text: `Fallback SMS alert for scenario ${scenarioIndex}` } }],
        },
      ],
    };
  }

  return request;
}
