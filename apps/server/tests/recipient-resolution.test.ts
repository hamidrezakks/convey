import { describe, expect, it } from 'bun:test';
import { db } from '../src/db';
import { messages } from '../src/db/schema';
import { AdminService } from '../src/modules/admin/admin.service';
import { validateChannelRecipients } from '../src/modules/messaging/messaging.service';
import { Channel, IdentifierType } from '../src/modules/messaging/messaging.types';
import { generateMessageId } from '../src/utils/id';
import { extractRecipientIdentifiers, formatRecipientDisplay } from '../src/utils/recipients';

describe('Recipient Resolution & Omnichannel Destination Architecture', () => {
  describe('formatRecipientDisplay()', () => {
    it('formats Email channel with email recipient', () => {
      const recipients = { email: 'alice@company.com', phone: '+15551234567' };
      expect(formatRecipientDisplay(recipients, Channel.EMAIL, 'usr_101')).toBe('alice@company.com');
    });

    it('formats SMS channel with phone number', () => {
      const recipients = { phone: '+15559876543' };
      expect(formatRecipientDisplay(recipients, Channel.SMS, 'usr_102')).toBe('+15559876543');
    });

    it('formats WhatsApp channel with whatsapp number or phone fallback', () => {
      const recipientsWithWa = { whatsapp: '+447700900077', phone: '+15550001111' };
      expect(formatRecipientDisplay(recipientsWithWa, Channel.WHATSAPP, 'usr_103')).toBe('+447700900077');

      const recipientsWithPhoneOnly = { phone: '+447700900077' };
      expect(formatRecipientDisplay(recipientsWithPhoneOnly, Channel.WHATSAPP, 'usr_104')).toBe('+447700900077');
    });

    it('formats Telegram channel with telegramChatId', () => {
      const recipients = { telegramChatId: 'tg_chat_883912' };
      expect(formatRecipientDisplay(recipients, Channel.TELEGRAM, 'usr_105')).toBe('tg_chat_883912');
    });

    it('formats Slack channel with slack channel ID', () => {
      const recipients = { slack: { channelId: 'C08912345' } };
      expect(formatRecipientDisplay(recipients, Channel.SLACK, 'usr_106')).toBe('C08912345');
    });

    it('formats FCM and APNs push channels with device tokens', () => {
      const fcmRecipients = { fcmTokens: ['fcm_token_device_abc', 'fcm_token_device_def'] };
      expect(formatRecipientDisplay(fcmRecipients, Channel.FCM, 'usr_107')).toBe('fcm_token_device_abc');

      const apnsRecipients = { apnsTokens: ['apns_token_device_xyz'] };
      expect(formatRecipientDisplay(apnsRecipients, Channel.APNS, 'usr_108')).toBe('apns_token_device_xyz');

      const pushGeneric = { fcmTokens: ['fcm_token_generic_999'] };
      expect(formatRecipientDisplay(pushGeneric, Channel.PUSH, 'usr_109')).toBe('fcm_token_generic_999');
    });

    it('falls back to userId when channel-specific handle is absent', () => {
      const emptyRecipients = {};
      expect(formatRecipientDisplay(emptyRecipients, Channel.SMS, 'usr_fallback_99')).toBe('usr_fallback_99');
      expect(formatRecipientDisplay(null, Channel.EMAIL, 'usr_fallback_null')).toBe('usr_fallback_null');
    });

    it('falls back to Unknown when no recipient handle and no userId exist', () => {
      expect(formatRecipientDisplay({}, Channel.SMS)).toBe('Unknown');
      expect(formatRecipientDisplay(null, Channel.EMAIL)).toBe('Unknown');
    });
  });

  describe('extractRecipientIdentifiers()', () => {
    it('extracts all populated contact handles and userId', () => {
      const recipients = {
        email: 'dev@convey.io',
        phone: '+15551112222',
        whatsapp: '+15551112222',
        telegramChatId: 'chat_777',
        slack: { channelId: 'C0123' },
        fcmTokens: ['fcm_1', 'fcm_2'],
        apnsTokens: ['apns_1'],
      };

      const extracted = extractRecipientIdentifiers(recipients, 'usr_omni_01');

      expect(extracted).toContainEqual({ type: IdentifierType.EMAIL, raw: 'dev@convey.io' });
      expect(extracted).toContainEqual({ type: IdentifierType.PHONE, raw: '+15551112222' });
      expect(extracted).toContainEqual({ type: IdentifierType.WHATSAPP, raw: '+15551112222' });
      expect(extracted).toContainEqual({ type: IdentifierType.TELEGRAM, raw: 'chat_777' });
      expect(extracted).toContainEqual({ type: IdentifierType.SLACK, raw: 'C0123' });
      expect(extracted).toContainEqual({ type: IdentifierType.PUSH, raw: 'fcm_1' });
      expect(extracted).toContainEqual({ type: IdentifierType.PUSH, raw: 'fcm_2' });
      expect(extracted).toContainEqual({ type: IdentifierType.PUSH, raw: 'apns_1' });
      expect(extracted).toContainEqual({ type: IdentifierType.USER_ID, raw: 'usr_omni_01' });
    });

    it('returns empty array when recipients and userId are missing', () => {
      expect(extractRecipientIdentifiers(null, null)).toEqual([]);
      expect(extractRecipientIdentifiers({}, undefined)).toEqual([]);
    });
  });

  describe('validateChannelRecipients()', () => {
    it('passes for SMS channel with phone only (does not require email)', () => {
      const error = validateChannelRecipients([{ channel: Channel.SMS, content: { text: 'Test OTP' } }], {
        phone: '+15550192831',
      });
      expect(error).toBeNull();
    });

    it('fails for SMS channel when phone is missing', () => {
      const error = validateChannelRecipients([{ channel: Channel.SMS, content: { text: 'Test OTP' } }], {
        email: 'user@example.com',
      });
      expect(error).toBe('Valid phone number is required for SMS channel');
    });

    it('passes for Email channel with email only (does not require phone)', () => {
      const error = validateChannelRecipients(
        [{ channel: Channel.EMAIL, content: { subject: 'Welcome', html: '<p>Hi</p>' } }],
        { email: 'customer@brand.com' },
      );
      expect(error).toBeNull();
    });

    it('fails for Email channel when email is missing', () => {
      const error = validateChannelRecipients([{ channel: Channel.EMAIL, content: { subject: 'Welcome' } }], {
        phone: '+15551234567',
      });
      expect(error).toBe('Valid email address is required for email channel');
    });

    it('validates Telegram and Slack channels correctly', () => {
      const telegramOk = validateChannelRecipients([{ channel: Channel.TELEGRAM, content: { text: 'Alert' } }], {
        telegramChatId: '12345678',
      });
      expect(telegramOk).toBeNull();

      const telegramFail = validateChannelRecipients([{ channel: Channel.TELEGRAM, content: { text: 'Alert' } }], {
        email: 'user@example.com',
      });
      expect(telegramFail).toBe('Valid Telegram chat ID is required for Telegram channel');

      const slackOk = validateChannelRecipients([{ channel: Channel.SLACK, content: { text: 'Deploy complete' } }], {
        slack: { channelId: 'C09988' },
      });
      expect(slackOk).toBeNull();

      const slackFail = validateChannelRecipients(
        [{ channel: Channel.SLACK, content: { text: 'Deploy complete' } }],
        {},
      );
      expect(slackFail).toBe('Valid Slack channel ID is required for Slack channel');
    });
  });

  describe('AdminService Message Resolution from Database', () => {
    const adminService = new AdminService();

    it('correctly maps SMS phone number and Slack channel from DB rows (does not fallback to user@enterprise.com)', async () => {
      const smsPubId = generateMessageId();
      const slackPubId = generateMessageId();
      const teamId = `team_test_rec_${Date.now()}`;

      // Insert test SMS message
      await db.insert(messages).values({
        id: smsPubId.replace(/^msg_/, ''),
        publicId: smsPubId,
        userId: 'usr_sms_test_99',
        team: teamId,
        category: 'transactional',
        country: 'US',
        state: 'delivered',
        priority: 'normal',
        isSandbox: false,
        recipients: { phone: '+15558889999' },
        channels: [{ channel: Channel.SMS, content: { text: 'Your verification code is 123456' } }],
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
      });

      // Insert test Slack message
      await db.insert(messages).values({
        id: slackPubId.replace(/^msg_/, ''),
        publicId: slackPubId,
        userId: 'usr_slack_test_100',
        team: teamId,
        category: 'alert',
        country: 'US',
        state: 'delivered',
        priority: 'critical',
        isSandbox: false,
        recipients: { slack: { channelId: 'C07ALERTCH' } },
        channels: [{ channel: Channel.SLACK, content: { text: 'High CPU alert on cluster node 1' } }],
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
      });

      // Query list messages by team
      const res = await adminService.listMessages({ teamId, limit: 10 });
      expect(res.messages.length).toBe(2);

      const smsMsg = res.messages.find((m) => m.publicId === smsPubId);
      expect(smsMsg).toBeDefined();
      expect(smsMsg?.recipient).toBe('+15558889999');
      expect(smsMsg?.recipient).not.toBe('user@enterprise.com');

      const slackMsg = res.messages.find((m) => m.publicId === slackPubId);
      expect(slackMsg).toBeDefined();
      expect(slackMsg?.recipient).toBe('C07ALERTCH');
      expect(slackMsg?.recipient).not.toBe('user@enterprise.com');

      // Query getMessageDetails
      const smsDetail = await adminService.getMessageDetails(smsPubId);
      expect(smsDetail).not.toBeNull();
      expect(smsDetail?.recipient).toBe('+15558889999');

      const slackDetail = await adminService.getMessageDetails(slackPubId);
      expect(slackDetail).not.toBeNull();
      expect(slackDetail?.recipient).toBe('C07ALERTCH');
    });
  });
});
