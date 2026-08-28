/**
 * @convey/sdk Example 01: Quickstart Omnichannel Dispatches
 *
 * Demonstrates sending messages across all supported channels:
 * Email, SMS, WhatsApp, Slack, Push (FCM/APNS), Telegram, and Omnichannel Cascade.
 */

import { Channel, Convey, MessagePriority } from '../src';

const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY || 'sk_live_sample_key',
  baseUrl: process.env.CONVEY_BASE_URL || 'https://api.convey.dev',
  teamId: 'marketing-core',
});

async function main() {
  console.log('--- 1. Transactional Email with HTML & Attachments ---');
  const emailRes = await convey.messages.send({
    channel: Channel.EMAIL,
    recipient: 'alex.doe@example.com',
    priority: MessagePriority.HIGH,
    content: {
      subject: 'Your Monthly Invoice #INV-2026-08',
      body: '<p>Hi Alex, your invoice of <strong>$149.00</strong> is ready.</p>',
    },
    metadata: {
      invoiceId: 'inv_8892',
      customerTier: 'enterprise',
    },
    idempotencyKey: 'inv_email_alex_2026_08',
  });
  console.log(`Accepted Email: ${emailRes.publicId} (Status: ${emailRes.status})`);

  console.log('\n--- 2. Urgent Two-Factor SMS with Critical Priority ---');
  const smsRes = await convey.messages.send({
    channel: Channel.SMS,
    recipient: '+14155552671',
    priority: MessagePriority.CRITICAL,
    content: {
      body: 'Your Convey verification code is: 489-201. Expires in 5 minutes.',
    },
    category: 'SECURITY',
  });
  console.log(`Accepted SMS: ${smsRes.publicId} (Status: ${smsRes.status})`);

  console.log('\n--- 3. WhatsApp Message with Dynamic Template Variables ---');
  const waRes = await convey.messages.send({
    channel: Channel.WHATSAPP,
    recipient: '+447911123456',
    content: {
      templateId: 'order_status_update_v2',
      variables: {
        customer_name: 'Jordan',
        order_id: 'ORD-9921',
        estimated_delivery: 'Tomorrow by 2 PM',
      },
    },
  });
  console.log(`Accepted WhatsApp: ${waRes.publicId}`);

  console.log('\n--- 4. Slack Incident Alert with Channel ID ---');
  const slackRes = await convey.messages.send({
    channel: Channel.SLACK,
    recipient: 'C0123456789', // Target Slack Channel ID
    priority: MessagePriority.CRITICAL,
    content: {
      body: '🚨 *INCIDENT ALERT*: Database replica lag exceeded 500ms on US-East.',
    },
  });
  console.log(`Accepted Slack Alert: ${slackRes.publicId}`);

  console.log('\n--- 5. Mobile Push Notification (FCM / APNS) ---');
  const pushRes = await convey.messages.send({
    channel: Channel.PUSH,
    recipient: 'fcm_token_device_device_identifier_abc123',
    content: {
      subject: 'Flash Sale Started! ⚡',
      body: 'Get 30% off developer tools for the next 2 hours.',
    },
  });
  console.log(`Accepted Push Notification: ${pushRes.publicId}`);

  console.log('\n--- 6. Omnichannel Cascade with Automatic Fallback ---');
  const cascadeRes = await convey.messages.send({
    userId: 'usr_premium_789',
    team: 'growth',
    country: 'US',
    priority: 'HIGH',
    recipients: {
      email: 'jordan@enterprise.com',
      phone: '+15559876543',
    },
    channels: [
      {
        channel: 'email',
        content: {
          subject: 'Contract Signature Required',
          html: '<p>Please sign your updated SLA agreement.</p>',
        },
      },
      {
        channel: 'sms',
        content: {
          text: 'Convey: Signature needed for SLA agreement. Link: https://convey.dev/sign/88',
        },
      },
    ],
    cascade: {
      steps: [
        { channel: 'email', waitForReceiptMs: 120000 }, // Wait 2 minutes for delivery/read receipt
        { channel: 'sms' }, // Fallback to SMS if email unopened
      ],
    },
  });
  console.log(`Accepted Omnichannel Cascade: ${cascadeRes.publicId}`);
}

main().catch(console.error);
