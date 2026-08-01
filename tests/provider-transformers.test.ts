import { describe, expect, it } from 'bun:test';
import { Channel } from '../src/modules/messaging/messaging.types';
import { cequensWhatsappTransformer } from '../src/modules/providers/chat/cequens-whatsapp/cequens-whatsapp.transformer';
import { chatWebhookTransformer } from '../src/modules/providers/chat/chat-webhook/chat-webhook.transformer';
import { discordTransformer } from '../src/modules/providers/chat/discord/discord.transformer';
import { slackTransformer } from '../src/modules/providers/chat/slack/slack.transformer';
import { telegramTransformer } from '../src/modules/providers/chat/telegram/telegram.transformer';
import { twilioWhatsappTransformer } from '../src/modules/providers/chat/twilio-whatsapp/twilio-whatsapp.transformer';
import { whatsappBusinessTransformer } from '../src/modules/providers/chat/whatsapp-business/whatsapp-business.transformer';
import { brevoTransformer } from '../src/modules/providers/email/brevo/brevo.transformer';
import { mailgunTransformer } from '../src/modules/providers/email/mailgun/mailgun.transformer';
import { postmarkTransformer } from '../src/modules/providers/email/postmark/postmark.transformer';
import { resendTransformer } from '../src/modules/providers/email/resend/resend.transformer';
import { SendgridEmailAdapter } from '../src/modules/providers/email/sendgrid/sendgrid.adapter';
import { sendgridTransformer } from '../src/modules/providers/email/sendgrid/sendgrid.transformer';
import { sesTransformer } from '../src/modules/providers/email/ses/ses.transformer';
import { apnsTransformer } from '../src/modules/providers/push/apns/apns.transformer';
import { expoTransformer } from '../src/modules/providers/push/expo/expo.transformer';
import { fcmTransformer } from '../src/modules/providers/push/fcm/fcm.transformer';
import { oneSignalTransformer } from '../src/modules/providers/push/one-signal/one-signal.transformer';
import { pushpadTransformer } from '../src/modules/providers/push/pushpad/pushpad.transformer';
import { infobipSmsTransformer } from '../src/modules/providers/sms/infobip/infobip.transformer';
import { plivoTransformer } from '../src/modules/providers/sms/plivo/plivo.transformer';
import { snsTransformer } from '../src/modules/providers/sms/sns/sns.transformer';
import { telnyxTransformer } from '../src/modules/providers/sms/telnyx/telnyx.transformer';
import { TwilioSmsAdapter } from '../src/modules/providers/sms/twilio/twilio.adapter';
import { twilioTransformer } from '../src/modules/providers/sms/twilio/twilio.transformer';
import { grafanaTransformer } from '../src/modules/providers/tool/grafana/grafana.transformer';
import { opsgenieTransformer } from '../src/modules/providers/tool/opsgenie/opsgenie.transformer';
import { pagerdutyTransformer } from '../src/modules/providers/tool/pagerduty/pagerduty.transformer';
import { toolWebhookTransformer } from '../src/modules/providers/tool/tool-webhook/tool-webhook.transformer';

describe('Global to Provider Transformers & Lifecycle Standard', () => {
  describe('SendGrid Email Adapter & Transformer', () => {
    it('transforms global options to SendGrid API request format', () => {
      const req = sendgridTransformer.transformRequest(
        {
          recipient: { email: 'user@example.com' },
          content: { subject: 'Welcome!', text: 'Hello world' },
          from: 'sender@example.com',
          senderName: 'App Team',
        },
        { apiKey: 'sg_key_123', ipPoolName: 'dedicated-pool' },
      );

      expect(req.personalizations[0].to[0].email).toBe('user@example.com');
      expect(req.from.email).toBe('sender@example.com');
      expect(req.from.name).toBe('App Team');
      expect(req.subject).toBe('Welcome!');
      expect(req.content[0].value).toBe('Hello world');
      expect(req.ip_pool_name).toBe('dedicated-pool');
    });

    it('transforms SendGrid response to global response format', () => {
      const res = sendgridTransformer.transformResponse({}, 202, { 'x-message-id': 'msg_sg_999' });
      expect(res.success).toBe(true);
      expect(res.providerMessageId).toBe('msg_sg_999');
    });

    it('instantiates SendgridEmailAdapter with typed config', () => {
      const adapter = new SendgridEmailAdapter({ apiKey: 'sg_123' });
      expect(adapter.id).toBe('sendgrid');
    });
  });

  describe('Resend Email Transformer', () => {
    it('transforms global options to Resend API request format', () => {
      const req = resendTransformer.transformRequest(
        {
          recipient: { email: 'john@example.com' },
          content: { subject: 'Invoice #101', html: '<p>Paid</p>' },
          from: 'billing@example.com',
        },
        { apiKey: 're_123' },
      );

      expect(req.to).toBe('john@example.com');
      expect(req.from).toBe('billing@example.com');
      expect(req.subject).toBe('Invoice #101');
      expect(req.html).toBe('<p>Paid</p>');
    });

    it('transforms Resend API response', () => {
      const res = resendTransformer.transformResponse({ id: 'res_id_789' }, 200);
      expect(res.success).toBe(true);
      expect(res.providerMessageId).toBe('res_id_789');
    });
  });

  describe('Brevo Email Transformer', () => {
    it('transforms global options to Brevo SMTP API request format', () => {
      const req = brevoTransformer.transformRequest(
        {
          recipient: { email: ['a@example.com', 'b@example.com'] },
          content: { subject: 'Newsletter', html: '<b>News</b>' },
          from: 'news@example.com',
          senderName: 'Newsletter Team',
        },
        { apiKey: 'xkeysib-123' },
      );

      expect(req.to).toHaveLength(2);
      expect(req.to[0].email).toBe('a@example.com');
      expect(req.sender?.email).toBe('news@example.com');
      expect(req.sender?.name).toBe('Newsletter Team');
      expect(req.subject).toBe('Newsletter');
    });
  });

  describe('Mailgun Email Transformer', () => {
    it('transforms global options to Mailgun API format', () => {
      const req = mailgunTransformer.transformRequest(
        {
          recipient: { email: 'user@domain.com' },
          content: { subject: 'Verify Email', text: 'Click link' },
          from: 'no-reply@domain.com',
        },
        { apiKey: 'key-123', domain: 'domain.com' },
      );

      expect(req.to).toBe('user@domain.com');
      expect(req.from).toBe('no-reply@domain.com');
      expect(req.subject).toBe('Verify Email');
      expect(req.text).toBe('Click link');
    });
  });

  describe('Postmark Email Transformer', () => {
    it('transforms global options to Postmark API format', () => {
      const req = postmarkTransformer.transformRequest(
        {
          recipient: { email: 'client@company.com' },
          content: { subject: 'Receipt', html: '<b>Receipt</b>' },
          from: 'sales@company.com',
        },
        { serverToken: 'postmark-token' },
      );

      expect(req.To).toBe('client@company.com');
      expect(req.From).toBe('sales@company.com');
      expect(req.Subject).toBe('Receipt');
      expect(req.HtmlBody).toBe('<b>Receipt</b>');
    });
  });

  describe('AWS SES Email Transformer', () => {
    it('transforms global options to AWS SES v2 format', () => {
      const req = sesTransformer.transformRequest(
        {
          recipient: { email: 'recipient@aws.com' },
          content: { subject: 'AWS Alert', text: 'All systems normal' },
          from: 'alerts@aws.com',
        },
        { region: 'us-west-2' },
      );

      expect(req.Destination.ToAddresses[0]).toBe('recipient@aws.com');
      expect(req.FromEmailAddress).toBe('alerts@aws.com');
      expect(req.Content.Simple.Subject.Data).toBe('AWS Alert');
      expect(req.Content.Simple.Body.Text?.Data).toBe('All systems normal');
    });
  });

  describe('Twilio SMS Adapter & Transformer', () => {
    it('transforms global options to Twilio API request format', () => {
      const req = twilioTransformer.transformRequest(
        {
          recipient: { phone: '+15551234567' },
          content: { text: 'Your OTP is 123456' },
          from: '+15559876543',
        },
        { accountSid: 'AC123', authToken: 'auth456' },
      );

      expect(req.To).toBe('+15551234567');
      expect(req.From).toBe('+15559876543');
      expect(req.Body).toBe('Your OTP is 123456');
    });

    it('transforms Twilio API response to global response format', () => {
      const res = twilioTransformer.transformResponse({ sid: 'SM1234567890', status: 'queued' }, 201);
      expect(res.success).toBe(true);
      expect(res.providerMessageId).toBe('SM1234567890');
    });

    it('instantiates TwilioSmsAdapter with typed config', () => {
      const adapter = new TwilioSmsAdapter({ accountSid: 'AC1', authToken: 'token1' });
      expect(adapter.id).toBe('twilio');
    });
  });

  describe('Infobip SMS Transformer', () => {
    it('transforms global options to Infobip SMS payload format', () => {
      const req = infobipSmsTransformer.transformRequest(
        {
          recipient: { phone: '+1234567890' },
          content: { text: 'Your Infobip OTP code is 9988' },
          from: 'InfobipSender',
        },
        { apiKey: 'key', baseUrl: 'https://api.infobip.com' },
      );

      expect(req.messages[0].destinations[0].to).toBe('+1234567890');
      expect(req.messages[0].from).toBe('InfobipSender');
      expect(req.messages[0].text).toBe('Your Infobip OTP code is 9988');
    });
  });

  describe('Plivo SMS Transformer', () => {
    it('transforms global options to Plivo SMS payload format', () => {
      const req = plivoTransformer.transformRequest(
        {
          recipient: { phone: '+1987654321' },
          content: { text: 'Plivo verification message' },
          from: '+1555000111',
        },
        { authId: 'id', authToken: 'tok' },
      );

      expect(req.dst).toBe('+1987654321');
      expect(req.src).toBe('+1555000111');
      expect(req.text).toBe('Plivo verification message');
    });
  });

  describe('Telnyx SMS Transformer', () => {
    it('transforms global options to Telnyx SMS payload format', () => {
      const req = telnyxTransformer.transformRequest(
        {
          recipient: { phone: '+18005550199' },
          content: { text: 'Telnyx SMS alert' },
          from: '+18005550100',
        },
        { apiKey: 'key_telnyx' },
      );

      expect(req.to).toBe('+18005550199');
      expect(req.from).toBe('+18005550100');
      expect(req.text).toBe('Telnyx SMS alert');
    });
  });

  describe('AWS SNS SMS Transformer', () => {
    it('transforms global options to AWS SNS Publish format', () => {
      const req = snsTransformer.transformRequest(
        {
          recipient: { phone: '+14155552671' },
          content: { text: 'AWS SNS SMS Security code 1234' },
          from: 'AWSAlert',
        },
        { region: 'us-east-1' },
      );

      expect(req.PhoneNumber).toBe('+14155552671');
      expect(req.Message).toBe('AWS SNS SMS Security code 1234');
      expect(req.MessageAttributes?.['AWS.SNS.SMS.SenderID']?.StringValue).toBe('AWSAlert');
    });
  });

  describe('Telegram Chat Adapter & Transformer', () => {
    it('transforms global options to Telegram Bot API request format', () => {
      const req = telegramTransformer.transformRequest({
        recipient: { chatId: '987654321' },
        content: { text: 'Alert notification!' },
      });

      expect(req.chat_id).toBe('987654321');
      expect(req.text).toBe('Alert notification!');
    });

    it('transforms Telegram Bot response to global response format', () => {
      const res = telegramTransformer.transformResponse({ ok: true, result: { message_id: 42 } }, 200);

      expect(res.success).toBe(true);
      expect(res.providerMessageId).toBe('42');
    });
  });

  describe('Discord Chat Transformer', () => {
    it('transforms global options to Discord webhook format', () => {
      const req = discordTransformer.transformRequest(
        {
          recipient: { webhookUrl: 'https://discord.com/api/webhooks/123/abc' },
          content: { title: 'Deployment Alert', text: 'Build #42 succeeded' },
          senderName: 'CI Bot',
        },
        {},
      );

      expect(req.content).toBe('Build #42 succeeded');
      expect(req.username).toBe('CI Bot');
      expect(req.embeds?.[0].title).toBe('Deployment Alert');
    });
  });

  describe('Slack Chat Transformer', () => {
    it('transforms global options to Slack payload format', () => {
      const req = slackTransformer.transformRequest(
        {
          recipient: { channel: '#general' },
          content: { text: 'Hello Slack channel' },
        },
        {},
      );

      expect(req.channel).toBe('#general');
      expect(req.text).toBe('Hello Slack channel');
    });
  });

  describe('WhatsApp Business Chat Transformer', () => {
    it('transforms global options to WhatsApp Cloud API format', () => {
      const req = whatsappBusinessTransformer.transformRequest(
        {
          recipient: { phone: '+15559998877' },
          content: { text: 'Your verification code is 4321' },
        },
        { phoneNumberId: 'pid_1', accessToken: 'token_1' },
      );

      expect(req.messaging_product).toBe('whatsapp');
      expect(req.to).toBe('+15559998877');
      expect(req.type).toBe('text');
      expect(req.text?.body).toBe('Your verification code is 4321');
    });
  });

  describe('Twilio WhatsApp Transformer', () => {
    it('transforms global options to Twilio WhatsApp payload format', () => {
      const req = twilioWhatsappTransformer.transformRequest(
        {
          recipient: { phone: '+15550009999' },
          content: { text: 'Twilio WhatsApp Message' },
          from: '+15554443333',
        },
        { accountSid: 'AC123', authToken: 'token456' },
      );

      expect(req.To).toBe('whatsapp:+15550009999');
      expect(req.From).toBe('whatsapp:+15554443333');
      expect(req.Body).toBe('Twilio WhatsApp Message');
    });
  });

  describe('Cequens WhatsApp Transformer', () => {
    it('transforms global options to Cequens WhatsApp payload format', () => {
      const req = cequensWhatsappTransformer.transformRequest(
        {
          recipient: { phone: '+201001234567' },
          content: { text: 'Cequens WhatsApp Alert' },
        },
        { apiKey: 'cq_key_123' },
      );

      expect(req.recipientPhone).toBe('+201001234567');
      expect(req.messageType).toBe('text');
      expect(req.text?.body).toBe('Cequens WhatsApp Alert');
    });
  });

  describe('Chat Webhook Transformer', () => {
    it('transforms global options to Chat Webhook payload format', () => {
      const req = chatWebhookTransformer.transformRequest(
        {
          recipient: { channel: 'general_room' },
          content: { text: 'System status report' },
        },
        { webhookUrl: 'https://chat.example.com/webhook' },
      );

      expect(req.channel).toBe('general_room');
      expect(req.text).toBe('System status report');
    });
  });

  describe('FCM Push Adapter & Transformer', () => {
    it('transforms global options to FCM API request format', () => {
      const req = fcmTransformer.transformRequest({
        recipient: { fcmTokens: ['token_abc_123'] },
        content: { title: 'New Message', body: 'You have received a message' },
      });

      expect(req.to).toBe('token_abc_123');
      expect(req.notification?.title).toBe('New Message');
      expect(req.notification?.body).toBe('You have received a message');
    });
  });

  describe('APNs Push Transformer', () => {
    it('transforms global options to APNs payload format', () => {
      const req = apnsTransformer.transformRequest(
        {
          recipient: { deviceTokens: ['device_token_xyz'] },
          content: { title: 'iOS Alert', body: 'Push notification' },
        },
        { key: 'k', keyId: 'kid', teamId: 'tid', bundleId: 'com.app' },
      );

      expect(req.deviceToken).toBe('device_token_xyz');
      expect((req.aps.alert as { title: string }).title).toBe('iOS Alert');
    });
  });

  describe('Expo Push Transformer', () => {
    it('transforms global options to Expo Push payload format', () => {
      const req = expoTransformer.transformRequest({
        recipient: { deviceTokens: ['ExponentPushToken[123]'] },
        content: { title: 'Expo Title', body: 'Expo Body' },
      });

      expect(req[0].to).toEqual(['ExponentPushToken[123]']);
      expect(req[0].title).toBe('Expo Title');
    });
  });

  describe('OneSignal Push Transformer', () => {
    it('transforms global options to OneSignal API payload format', () => {
      const req = oneSignalTransformer.transformRequest(
        {
          recipient: { subscriberId: 'user_456' },
          content: { title: 'Hello', body: 'OneSignal Push' },
        },
        { appId: 'app_1', apiKey: 'key_1' },
      );

      expect(req.app_id).toBe('app_1');
      expect(req.include_external_user_ids).toEqual(['user_456']);
      expect(req.headings?.en).toBe('Hello');
      expect(req.contents.en).toBe('OneSignal Push');
    });
  });

  describe('Pushpad Push Transformer', () => {
    it('transforms global options to Pushpad API payload format', () => {
      const req = pushpadTransformer.transformRequest(
        {
          recipient: { subscriberId: 'uid_789' },
          content: { title: 'Pushpad Title', body: 'Pushpad Body' },
        },
        { authToken: 'auth', projectId: '123' },
      );

      expect(req.uids).toEqual(['uid_789']);
      expect(req.title).toBe('Pushpad Title');
      expect(req.body).toBe('Pushpad Body');
    });
  });

  describe('PagerDuty Tool Adapter & Transformer', () => {
    it('transforms global options to PagerDuty Event API format', () => {
      const req = pagerdutyTransformer.transformRequest(
        {
          recipient: { channel: 'pd_key_123' },
          content: { title: 'Database Outage', data: { severity: 'critical' } },
        },
        { routingKey: 'default_pd_key' },
      );

      expect(req.routing_key).toBe('pd_key_123');
      expect(req.payload.summary).toBe('Database Outage');
      expect(req.payload.severity).toBe('critical');
    });
  });

  describe('Grafana Tool Transformer', () => {
    it('transforms global options to Grafana Alertmanager payload format', () => {
      const req = grafanaTransformer.transformRequest(
        {
          recipient: { to: 'grafana_alert_channel' },
          content: { title: 'High CPU Usage', body: 'CPU usage is above 90%' },
        },
        { webhookUrl: 'https://grafana.example.com/api/v1/alerts' },
      );

      expect(req.receiver).toBe('grafana_alert_channel');
      expect(req.title).toBe('High CPU Usage');
      expect(req.message).toBe('High CPU Usage');
      expect(req.alerts[0].annotations.summary).toBe('High CPU Usage');
    });
  });

  describe('Opsgenie Tool Transformer', () => {
    it('transforms global options to Opsgenie Alert API format', () => {
      const req = opsgenieTransformer.transformRequest(
        {
          recipient: { to: 'genie_key_123' },
          content: { title: 'Payment Gateway Down', data: { priority: 'P1' } },
        },
        { apiKey: 'genie_key_123' },
      );

      expect(req.message).toBe('Payment Gateway Down');
      expect(req.priority).toBe('P1');
    });
  });

  describe('Tool Webhook Transformer', () => {
    it('transforms global options to Tool Webhook payload format', () => {
      const req = toolWebhookTransformer.transformRequest(
        {
          recipient: { channel: 'tool_channel_1' },
          content: { text: 'Custom tool alert payload' },
        },
        { webhookUrl: 'https://tool.example.com/webhook' },
      );

      expect(req.event).toBe('tool.dispatch');
      expect(req.data.content.text).toBe('Custom tool alert payload');
    });
  });

  describe('Provider Mock Request & Response Simulation', () => {
    it('simulates Twilio WhatsApp request payload & native API response', async () => {
      const { enableProviderMock, disableProviderMock, getMockRecordedRequests, resetProviderMockStats } = await import(
        './mocks/provider-mock'
      );
      enableProviderMock(0);
      resetProviderMockStats();

      const { twilioWhatsappTransformer } = await import(
        '../src/modules/providers/chat/twilio-whatsapp/twilio-whatsapp.transformer'
      );
      const reqPayload = twilioWhatsappTransformer.transformRequest(
        {
          recipient: { whatsapp: '+971501234567' },
          content: { text: 'Hello via WhatsApp!' },
          from: '+14155238886',
        },
        { accountSid: 'AC123', authToken: 'auth123' },
      );

      expect(reqPayload.To).toBe('whatsapp:+971501234567');
      expect(reqPayload.From).toBe('whatsapp:+14155238886');
      expect(reqPayload.Body).toBe('Hello via WhatsApp!');

      const twilioRes = await fetch('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json?channel=whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(reqPayload as unknown as Record<string, string>).toString(),
      });

      expect(twilioRes.status).toBe(201);
      const twilioBody = (await twilioRes.json()) as { sid?: string; to?: string; status?: string };
      expect(twilioBody.sid).toBeDefined();
      expect(twilioBody.to).toBe('whatsapp:+971501234567');
      expect(twilioBody.status).toBe('queued');

      const recorded = getMockRecordedRequests();
      expect(recorded.length).toBe(1);
      expect(recorded[0].providerId).toBe('twilio-whatsapp');
      expect(recorded[0].outcome).toBe('success');

      // Verify co-located webhook generator
      const { twilioWhatsappMock } = await import('../src/modules/providers/chat/twilio-whatsapp/twilio-whatsapp.mock');
      const webhookPayload = twilioWhatsappMock.buildWebhookPayload({
        eventType: 'delivered',
        providerMessageId: twilioBody.sid || 'msg_123',
        recipient: '+971501234567',
      });
      expect(webhookPayload.payload).toBeDefined();
      expect((webhookPayload.payload as Record<string, unknown>).MessageStatus).toBe('delivered');
      expect((webhookPayload.payload as Record<string, unknown>).To).toBe('whatsapp:+971501234567');

      disableProviderMock();
    });

    it('simulates Cequens WhatsApp request payload & native API response', async () => {
      const { enableProviderMock, disableProviderMock, getMockRecordedRequests, resetProviderMockStats } = await import(
        './mocks/provider-mock'
      );
      enableProviderMock(0);
      resetProviderMockStats();

      const { cequensWhatsappTransformer } = await import(
        '../src/modules/providers/chat/cequens-whatsapp/cequens-whatsapp.transformer'
      );
      const reqPayload = cequensWhatsappTransformer.transformRequest(
        {
          recipient: { phone: '+971501234567' },
          content: { text: 'Hello via Cequens WhatsApp' },
        },
        { apiKey: 'ceq_key_123', clientRef: 'order_ref_999' },
      );

      expect(reqPayload.recipientPhone).toBe('+971501234567');
      expect(reqPayload.messageText).toBe('Hello via Cequens WhatsApp');
      expect(reqPayload.clientRef).toBe('order_ref_999');

      const cequensRes = await fetch('https://apis.cequens.com/whatsapp/v1/messages', {
        method: 'POST',
        headers: { Authorization: 'Bearer ceq_key_123', 'Content-Type': 'application/json' },
        body: JSON.stringify(reqPayload),
      });

      expect(cequensRes.status).toBe(200);
      const cequensBody = (await cequensRes.json()) as {
        replyCode?: number;
        replyMessage?: string;
        data?: { messageId?: string; clientRef?: string };
      };
      expect(cequensBody.replyCode).toBe(0);
      expect(cequensBody.replyMessage).toBe('ACCEPTED');
      expect(cequensBody.data?.messageId).toBeDefined();
      expect(cequensBody.data?.clientRef).toBe('order_ref_999');

      const recorded = getMockRecordedRequests();
      expect(recorded.length).toBe(1);
      expect(recorded[0].providerId).toBe('cequens-whatsapp');
      expect(recorded[0].outcome).toBe('success');

      // Verify co-located webhook generator
      const { cequensWhatsappMock } = await import(
        '../src/modules/providers/chat/cequens-whatsapp/cequens-whatsapp.mock'
      );
      const webhookPayload = cequensWhatsappMock.buildWebhookPayload({
        eventType: 'delivered',
        providerMessageId: cequensBody.data?.messageId || 'msg_123',
        recipient: '+971501234567',
      });
      expect(webhookPayload.payload).toBeDefined();
      expect((webhookPayload.payload as Record<string, unknown>).status).toBe('DELIVERED');
      expect((webhookPayload.payload as Record<string, unknown>).phone).toBe('+971501234567');

      disableProviderMock();
    });

    it('transforms and sends Webex Messaging request payload & receives mock response', async () => {
      const { enableProviderMock, disableProviderMock, getMockRecordedRequests, resetProviderMockStats } = await import(
        './mocks/provider-mock'
      );
      enableProviderMock(0);
      resetProviderMockStats();

      const { webexMessagingTransformer } = await import(
        '../src/modules/providers/chat/webex-messaging/webex-messaging.transformer'
      );
      const reqPayload = webexMessagingTransformer.transformRequest(
        {
          recipient: { email: 'dev@example.com' },
          content: { text: 'Hello via Webex' },
        },
        { bearerToken: 'webex_token_123' },
      );

      expect(reqPayload.toPersonEmail).toBe('dev@example.com');
      expect(reqPayload.text).toBe('Hello via Webex');

      const { WebexMessagingChatAdapter } = await import(
        '../src/modules/providers/chat/webex-messaging/webex-messaging.adapter'
      );
      const adapter = new WebexMessagingChatAdapter({ bearerToken: 'webex_token_123' });
      const res = await adapter.send({
        recipient: { email: 'dev@example.com' },
        content: { text: 'Hello via Webex' },
      });

      expect(res.success).toBe(true);
      expect(res.providerMessageId).toBeDefined();

      const recorded = getMockRecordedRequests();
      expect(recorded.length).toBe(1);
      expect(recorded[0].providerId).toBe('webex-messaging');
      expect(recorded[0].outcome).toBe('success');

      disableProviderMock();
    });

    it('simulates SendGrid, Resend, FCM, and Slack native responses', async () => {
      const { enableProviderMock, disableProviderMock, getMockRecordedRequests, resetProviderMockStats } = await import(
        './mocks/provider-mock'
      );
      enableProviderMock(0);
      resetProviderMockStats();

      // SendGrid 202
      const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer sg_123', 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalizations: [{ to: [{ email: 'test@example.com' }] }] }),
      });
      expect(sgRes.status).toBe(202);
      expect(sgRes.headers.get('x-message-id')).toBeDefined();

      // Resend 200
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer re_123', 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'onboarding@resend.dev', to: 'test@example.com' }),
      });
      expect(resendRes.status).toBe(200);
      const resendBody = (await resendRes.json()) as { id?: string };
      expect(resendBody.id).toBeDefined();

      // Slack 200
      const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { Authorization: 'Bearer xoxb-123', 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'C123456', text: 'Hello Slack' }),
      });
      expect(slackRes.status).toBe(200);
      const slackBody = (await slackRes.json()) as { ok?: boolean; ts?: string };
      expect(slackBody.ok).toBe(true);
      expect(slackBody.ts).toBeDefined();

      const recorded = getMockRecordedRequests();
      expect(recorded.length).toBe(3);

      disableProviderMock();
    });

    it('verifies all 17 chat provider modules have valid co-located mocks and webhook generators', async () => {
      const { ProviderRegistry } = await import('../src/modules/providers/core/provider-registry');
      const chatAdapters = ProviderRegistry.getByChannel(Channel.CHAT);

      expect(chatAdapters.length).toBe(17);

      for (const adapter of chatAdapters) {
        const mod =
          ProviderRegistry.getModule(adapter.id) || ProviderRegistry.getModuleByChannel(Channel.CHAT, adapter.id);

        expect(mod).toBeDefined();
        expect(mod?.mock).toBeDefined();
        expect(typeof mod?.mock?.matchesRequest).toBe('function');
        expect(typeof mod?.mock?.buildResponse).toBe('function');
        expect(typeof mod?.mock?.buildWebhookPayload).toBe('function');

        // Test webhook payload generator for this chat provider
        const webhookRes = mod?.mock?.buildWebhookPayload?.({
          eventType: 'delivered',
          providerMessageId: `${adapter.id}_test_msg_123`,
          recipient: 'recipient_test',
        });

        expect(webhookRes).toBeDefined();
        expect(webhookRes?.payload).toBeDefined();
        expect(webhookRes?.headers).toBeDefined();
      }
    });

    it('verifies all 39 SMS provider modules have valid co-located mocks and transformers', async () => {
      const { ProviderRegistry } = await import('../src/modules/providers/core/provider-registry');
      const smsAdapters = ProviderRegistry.getByChannel(Channel.SMS);

      expect(smsAdapters.length).toBe(39);

      for (const adapter of smsAdapters) {
        const mod =
          ProviderRegistry.getModule(adapter.id) || ProviderRegistry.getModuleByChannel(Channel.SMS, adapter.id);

        expect(mod).toBeDefined();
        expect(mod?.mock).toBeDefined();
        expect(typeof mod?.mock?.matchesRequest).toBe('function');
        expect(typeof mod?.mock?.buildResponse).toBe('function');
        expect(typeof mod?.mock?.buildWebhookPayload).toBe('function');

        // Test webhook payload generator for this SMS provider
        const webhookRes = mod?.mock?.buildWebhookPayload?.({
          eventType: 'delivered',
          providerMessageId: `${adapter.id}_test_msg_123`,
          recipient: '+971501234567',
        });

        expect(webhookRes).toBeDefined();
        expect(webhookRes?.payload).toBeDefined();
        expect(webhookRes?.headers).toBeDefined();
      }
    });

    it('verifies all 20 Email provider modules have valid co-located mocks and transformers', async () => {
      const { ProviderRegistry } = await import('../src/modules/providers/core/provider-registry');
      const emailAdapters = ProviderRegistry.getByChannel(Channel.EMAIL);

      expect(emailAdapters.length).toBe(20);

      for (const adapter of emailAdapters) {
        const mod =
          ProviderRegistry.getModule(adapter.id) || ProviderRegistry.getModuleByChannel(Channel.EMAIL, adapter.id);

        expect(mod).toBeDefined();
        expect(mod?.mock).toBeDefined();
        expect(typeof mod?.mock?.matchesRequest).toBe('function');
        expect(typeof mod?.mock?.buildResponse).toBe('function');
        expect(typeof mod?.mock?.buildWebhookPayload).toBe('function');

        // Test webhook payload generator for this Email provider
        const webhookRes = mod?.mock?.buildWebhookPayload?.({
          eventType: 'delivered',
          providerMessageId: `${adapter.id}_test_msg_123`,
          recipient: 'test@example.com',
        });

        expect(webhookRes).toBeDefined();
        expect(webhookRes?.payload).toBeDefined();
        expect(webhookRes?.headers).toBeDefined();
      }
    });

    it('verifies all 8 Push provider modules have valid co-located mocks and transformers', async () => {
      const { ProviderRegistry } = await import('../src/modules/providers/core/provider-registry');
      const pushAdapters = ProviderRegistry.getByChannel(Channel.PUSH);

      expect(pushAdapters.length).toBe(8);

      for (const adapter of pushAdapters) {
        const mod =
          ProviderRegistry.getModule(adapter.id) || ProviderRegistry.getModuleByChannel(Channel.PUSH, adapter.id);

        expect(mod).toBeDefined();
        expect(mod?.mock).toBeDefined();
        expect(typeof mod?.mock?.matchesRequest).toBe('function');
        expect(typeof mod?.mock?.buildResponse).toBe('function');
        expect(typeof mod?.mock?.buildWebhookPayload).toBe('function');

        // Test webhook payload generator for this Push provider
        const webhookRes = mod?.mock?.buildWebhookPayload?.({
          eventType: 'delivered',
          providerMessageId: `${adapter.id}_test_msg_123`,
          recipient: 'push_device_token_123',
        });

        expect(webhookRes).toBeDefined();
        expect(webhookRes?.payload).toBeDefined();
        expect(webhookRes?.headers).toBeDefined();
      }
    });

    it('verifies all 4 Tool provider modules have valid co-located mocks and transformers', async () => {
      const { ProviderRegistry } = await import('../src/modules/providers/core/provider-registry');
      const toolAdapters = ProviderRegistry.getByChannel(Channel.TOOL);

      expect(toolAdapters.length).toBe(4);

      for (const adapter of toolAdapters) {
        const mod =
          ProviderRegistry.getModule(adapter.id) || ProviderRegistry.getModuleByChannel(Channel.TOOL, adapter.id);

        expect(mod).toBeDefined();
        expect(mod?.mock).toBeDefined();
        expect(typeof mod?.mock?.matchesRequest).toBe('function');
        expect(typeof mod?.mock?.buildResponse).toBe('function');
        expect(typeof mod?.mock?.buildWebhookPayload).toBe('function');

        // Test webhook payload generator for this Tool provider
        const webhookRes = mod?.mock?.buildWebhookPayload?.({
          eventType: 'delivered',
          providerMessageId: `${adapter.id}_test_msg_123`,
          recipient: 'tool_target_123',
        });

        expect(webhookRes).toBeDefined();
        expect(webhookRes?.payload).toBeDefined();
        expect(webhookRes?.headers).toBeDefined();
      }
    });
  });
});
