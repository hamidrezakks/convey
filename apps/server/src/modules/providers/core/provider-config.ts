/** Translate console/environment field names into adapter configuration without reading process.env. */
const prefixes: Record<string, string[]> = {
  'webex-messaging': ['WEBEX'],
  ses: ['AWS_SES', 'AWS'],
  sns: ['AWS_SNS', 'AWS'],
  nodemailer: ['SMTP'],
  outlook365: ['MS_GRAPH'],
  nexmo: ['VONAGE'],
  'africas-talking': ['AFRICASTALKING'],
  'afro-sms': ['AFROSMS'],
  'azure-sms': ['AZURE_COMMUNICATION', 'AZURE'],
  'bulk-sms': ['BULKSMS'],
  'eazy-sms': ['EAZYSMS'],
  'isendpro-sms': ['ISENDPRO'],
  'ring-central': ['RINGCENTRAL'],
  'sms-central': ['SMSCENTRAL'],
  'one-signal': ['ONESIGNAL'],
  'whatsapp-business': ['WHATSAPP', 'META'],
  'twilio-whatsapp': ['TWILIO_WHATSAPP', 'TWILIO'],
  msteams: ['MS_TEAMS'],
  getstream: ['STREAM'],
  'grafana-on-call': ['GRAFANA_ONCALL'],
  'rocket-chat': ['ROCKETCHAT'],
};
const aliases: Record<string, string> = {
  FROM_EMAIL: 'from',
  FROM_NUMBER: 'from',
  FROM: 'from',
  SENDER_USER_ID: 'fromUser',
  ENDPOINT_URL: 'baseUrl',
  PRIVATE_KEY_P8: 'key',
  REST_API_KEY: 'apiKey',
  DEFAULT_CHANNEL_ID: 'channel',
  DEFAULT_CHAT_ID: 'chatId',
  DEFAULT_ROOM_ID: 'roomId',
  SITE_URL: 'domain',
  BOT_EMAIL: 'email',
  BOT_API_KEY: 'apiKey',
  API_KEY_ID: 'apiKey',
  API_SECRET_KEY: 'apiSecret',
};
const overrides: Record<string, Record<string, string>> = {
  nodemailer: { PASSWORD: 'pass' },
  'bulk-sms': { TOKEN_ID: 'username', TOKEN_SECRET: 'password' },
  bandwidth: { API_USER: 'username', API_PASSWORD: 'password' },
  'generic-sms': { AUTH_TOKEN: 'apiKey' },
  getstream: { API_SECRET: 'secret' },
  mattermost: { BOT_TOKEN: 'personalAccessToken' },
  'rocket-chat': { AUTH_TOKEN: 'token' },
  'webex-messaging': { ACCESS_TOKEN: 'bearerToken' },
  line: { CHANNEL_ACCESS_TOKEN: 'channelAccessToken' },
  grafana: { ALERTMANAGER_URL: 'webhookUrl', API_KEY: 'apiToken' },
};

export function normalizeProviderConfig<T extends object>(providerId: string, input: T): T & Record<string, unknown> {
  providerId = providerId.toLowerCase();
  const output = { ...input } as Record<string, unknown>;
  const allowedPrefixes = prefixes[providerId] || [providerId.replace(/-/g, '_').toUpperCase()];
  for (const [key, value] of Object.entries(input)) {
    const prefix = allowedPrefixes.find((item) => key.startsWith(`${item}_`));
    if (!prefix) continue;
    const suffix = key.slice(prefix.length + 1);
    let field =
      overrides[providerId]?.[suffix] ||
      aliases[suffix] ||
      suffix.toLowerCase().replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    if (providerId.endsWith('-webhook') && suffix === 'URL') field = 'webhookUrl';
    if (output[field] === undefined) output[field] = value;
  }
  for (const field of ['production', 'secure']) {
    if (typeof output[field] === 'string') output[field] = output[field].toLowerCase() === 'true';
  }
  if (typeof output.port === 'string' && /^\d+$/.test(output.port)) output.port = Number(output.port);
  if (providerId === 'fcm' && typeof output.serviceAccountJson === 'string') {
    try {
      const account = JSON.parse(output.serviceAccountJson) as Record<string, unknown>;
      output.projectId ??= account.project_id;
      output.email ??= account.client_email;
      output.privateKey ??= account.private_key;
    } catch {
      /* Setup validation reports missing credentials; never echo credential JSON. */
    }
  }
  return output as T & Record<string, unknown>;
}
