import crypto from 'node:crypto';

function randomHex(length: number): string {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

function randomBase64Url(length: number): string {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

export function generateProviderId(providerId: string, options?: { projectId?: string; domain?: string }): string {
  const now = Date.now();
  switch (providerId.toLowerCase()) {
    case 'resend':
      return `re_${randomBase64Url(24)}`;

    case 'twilio':
    case 'twilio-whatsapp':
      return `SM${randomHex(32)}`;

    case 'sendgrid':
      return `SG.${randomBase64Url(22)}.${randomBase64Url(22)}`;

    case 'slack':
      return `${Math.floor(now / 1000)}.${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;

    case 'fcm':
      return `projects/${options?.projectId || 'convey-test-project'}/messages/0:${now}000000%${randomHex(16)}`;

    case 'ses':
      return `010001${randomHex(10)}-${randomHex(8)}-${randomHex(4)}-${randomHex(4)}-${randomHex(4)}-${randomHex(12)}-000000`;

    case 'mailgun':
      return `<${now}.${randomHex(16)}@${options?.domain || 'convey.mock.net'}>`;

    case 'postmark':
      return crypto.randomUUID();

    case 'brevo':
    case 'brevo-sms':
      return `<${now}${randomHex(8)}@smtp-relay.mailin.fr>`;

    case 'discord':
      return `${now}${Math.floor(Math.random() * 1000)}`;

    case 'telegram':
      return String(Math.floor(100000 + Math.random() * 900000));

    case 'pagerduty':
      return `pd_dedup_${randomHex(16)}`;

    case 'opsgenie':
      return crypto.randomUUID();

    case 'infobip':
      return `${now}-${randomHex(8)}`;

    case 'plivo':
      return crypto.randomUUID();

    case 'telnyx':
      return crypto.randomUUID();

    case 'bandwidth':
      return `m-${randomHex(24)}`;

    case 'expo':
      return crypto.randomUUID();

    case 'one-signal':
      return crypto.randomUUID();

    case 'apns':
      return crypto.randomUUID();

    default:
      return `${providerId}_${crypto.randomUUID().replace(/-/g, '')}`;
  }
}
