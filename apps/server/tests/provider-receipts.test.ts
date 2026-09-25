import { expect, it } from 'bun:test';
import { WhatsappBusinessChatAdapter } from '../src/modules/providers/chat/whatsapp-business/whatsapp-business.adapter';
import { NormalizedStatus } from '../src/modules/providers/core/provider-types';
import { MailgunEmailAdapter } from '../src/modules/providers/email/mailgun/mailgun.adapter';
import { PostmarkEmailAdapter } from '../src/modules/providers/email/postmark/postmark.adapter';
import { ResendEmailAdapter } from '../src/modules/providers/email/resend/resend.adapter';
import { SendgridEmailAdapter } from '../src/modules/providers/email/sendgrid/sendgrid.adapter';

it('Resend and Postmark preserve bounce events rather than inventing delivery', () => {
  const resend = new ResendEmailAdapter();
  expect(resend.parseWebhook({ type: 'email.bounced', data: { email_id: 'id' } })[0]?.normalizedStatus).toBe(
    NormalizedStatus.BOUNCED,
  );
  expect(resend.parseWebhook({ type: 'email.sent', data: { email_id: 'id' } })).toEqual([]);
  expect(new PostmarkEmailAdapter().parseWebhook({ RecordType: 'Bounce', MessageID: 'id' })[0]?.normalizedStatus).toBe(
    NormalizedStatus.BOUNCED,
  );
});
it('Mailgun correlates using the message ID, ignores temporary failures', () => {
  const adapter = new MailgunEmailAdapter();
  const data = { id: 'event-id', message: { headers: { 'message-id': '<message-id>' } } };
  expect(adapter.parseWebhook({ 'event-data': { ...data, event: 'delivered' } })[0]?.providerMessageId).toBe(
    'message-id',
  );
  expect(adapter.parseWebhook({ 'event-data': { ...data, event: 'failed', severity: 'temporary' } })).toEqual([]);
  expect(
    adapter.parseWebhook({ 'event-data': { ...data, event: 'failed', severity: 'permanent' } })[0]?.normalizedStatus,
  ).toBe(NormalizedStatus.FAILED);
});
it('SendGrid and WhatsApp do not turn intermediate statuses into delivery', () => {
  const sendgrid = new SendgridEmailAdapter();
  for (const event of ['processed', 'deferred', 'unknown'])
    expect(sendgrid.parseWebhook([{ sg_message_id: 'id', event }])).toEqual([]);
  expect(sendgrid.parseWebhook([{ sg_message_id: 'id', event: 'delivered' }])[0]?.normalizedStatus).toBe(
    NormalizedStatus.DELIVERED,
  );
  const whatsapp = new WhatsappBusinessChatAdapter();
  for (const status of ['sent', 'unknown'])
    expect(whatsapp.parseWebhook({ entry: [{ changes: [{ value: { statuses: [{ id: 'id', status }] } }] }] })).toEqual(
      [],
    );
});
