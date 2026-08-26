import { beforeAll, describe, expect, it } from 'bun:test';
import { initializePluginTables } from '../src/db';
import { PreferencesService } from '../src/modules/preferences/preferences.service';
import { Rfc8058 } from '../src/modules/preferences/rfc8058';

describe('Plugins App: Recipient Preferences & Consent Governance', () => {
  const testTenant = '019ff136-0000-7000-8000-000000000001';
  const testTeam = 'fintech-team';

  beforeAll(async () => {
    await initializePluginTables();
  });

  describe('1. RFC-8058 Utilities', () => {
    it('generates standard RFC-8058 compliant headers', () => {
      const token = 'unsub_test_token_123';
      const headers = Rfc8058.generateHeaders('https://api.convey.dev', token);

      expect(headers['List-Unsubscribe']).toContain(
        'https://api.convey.dev/api/v1/plugins/preferences/unsubscribe?token=unsub_test_token_123',
      );
      expect(headers['List-Unsubscribe']).toContain('mailto:unsub+unsub_test_token_123@unsub.convey.dev');
      expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    });
  });

  describe('2. Topics & Preferences Lifecycle', () => {
    const userRecipientId = `usr_${Date.now()}`;

    it('creates topic and manages recipient opt-in preferences', async () => {
      // 1. Create a marketing topic
      const topic = await PreferencesService.createOrUpdateTopic({
        tenantId: testTenant,
        team: testTeam,
        key: 'marketing_newsletter',
        name: 'Marketing Newsletter',
        description: 'Weekly product and discount updates',
        isMandatory: false,
        defaultChannels: ['email'],
      });

      expect(topic.key).toBe('marketing_newsletter');

      // 2. Set recipient preferences (opted out of marketing_newsletter, SMS disabled)
      const pref = await PreferencesService.upsertPreferences({
        tenantId: testTenant,
        team: testTeam,
        recipientId: userRecipientId,
        email: 'alice@example.com',
        channelPreferences: { sms: false, email: true },
        topicPreferences: { marketing_newsletter: false },
      });

      expect(pref.recipientId).toBe(userRecipientId);
      expect(pref.channelPreferences.sms).toBe(false);
      expect(pref.topicPreferences.marketing_newsletter).toBe(false);
      expect(pref.unsubscribeToken).toBeDefined();

      // 3. Check dispatch for marketing email (should be rejected)
      const checkMarketing = await PreferencesService.checkDispatchAllowed({
        tenantId: testTenant,
        recipientId: userRecipientId,
        channel: 'email',
        topicKey: 'marketing_newsletter',
      });

      expect(checkMarketing.allowed).toBe(false);
      expect(checkMarketing.reason).toBe('OPTED_OUT_TOPIC');

      // 4. Check dispatch for SMS (should be rejected at channel level)
      const checkSms = await PreferencesService.checkDispatchAllowed({
        tenantId: testTenant,
        recipientId: userRecipientId,
        channel: 'sms',
      });

      expect(checkSms.allowed).toBe(false);
      expect(checkSms.reason).toBe('DISABLED_CHANNEL');

      // 5. Check dispatch for transactional/billing email (should be allowed)
      const checkBilling = await PreferencesService.checkDispatchAllowed({
        tenantId: testTenant,
        recipientId: userRecipientId,
        channel: 'email',
        topicKey: 'billing_alerts',
      });

      expect(checkBilling.allowed).toBe(true);
    });

    it('handles one-click unsubscribe flow', async () => {
      const userUnsub = `usr_unsub_${Date.now()}`;
      const pref = await PreferencesService.upsertPreferences({
        tenantId: testTenant,
        team: testTeam,
        recipientId: userUnsub,
        email: 'bob@example.com',
      });

      const unsubResult = await PreferencesService.handleUnsubscribe(pref.unsubscribeToken);
      expect(unsubResult.success).toBe(true);

      const updatedPref = await PreferencesService.getPreferences(testTenant, userUnsub);
      expect(updatedPref?.channelPreferences.email).toBe(false);
      expect(updatedPref?.channelPreferences.sms).toBe(false);
    });
  });
});
