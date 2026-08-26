import { describe, expect, it } from 'bun:test';
import { Channel } from '@convey/shared';
import { TemplatesService } from '../src/modules/templates/templates.service';

describe('Rich Email Template Capabilities', () => {
  const tenantId = '019ff136-0000-7000-8000-000000000001';
  const team = 'qa-rich-email';

  it('renders rich email template with preheader, sender metadata, brand theme, and attachments', async () => {
    const rendered = await TemplatesService.renderTemplate({
      tenantId,
      team,
      request: {
        templateSpec: {
          email: {
            subject: 'Invoice #{{invoiceNumber}} for {{recipient.name}}',
            previewText: 'Payment of {{amount | currency: "USD"}} was processed successfully.',
            fromName: '{{brandName}} Billing Team',
            fromEmail: 'billing@{{domain}}',
            replyTo: 'support@{{domain}}',
            brandTheme: {
              primaryColor: '#6366f1',
              backgroundColor: '#f1f5f9',
              fontFamily: 'Inter, sans-serif',
            },
            attachments: [
              {
                filename: 'Invoice_{{invoiceNumber}}.pdf',
                contentType: 'application/pdf',
                sizeBytes: 104857,
              },
            ],
            mjml: `<mjml>
  <mj-body background-color="#f1f5f9">
    <mj-section>
      <mj-column>
        <mj-text font-size="20px" font-weight="bold">Invoice #{{invoiceNumber}}</mj-text>
        <mj-text>Dear {{recipient.name}}, thank you for your payment of {{amount | currency: "USD"}}.</mj-text>
        <mj-button href="https://{{domain}}/invoices/{{invoiceNumber}}" background-color="#6366f1">Download Receipt</mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
          },
        },
        channel: Channel.EMAIL,
        variables: {
          invoiceNumber: 'INV-88291',
          amount: 450.0,
          brandName: 'Convey Cloud',
          domain: 'convey.dev',
          recipient: { name: 'Sophia Miller', email: 'sophia@example.com' },
        },
      },
    });

    expect(rendered.channel).toBe(Channel.EMAIL);
    expect(rendered.subject).toBe('Invoice #INV-88291 for Sophia Miller');
    expect(rendered.renderedEmail).toBeDefined();
    expect(rendered.renderedEmail?.fromName).toBe('Convey Cloud Billing Team');
    expect(rendered.renderedEmail?.fromEmail).toBe('billing@convey.dev');
    expect(rendered.renderedEmail?.replyTo).toBe('support@convey.dev');
    expect(rendered.renderedEmail?.previewText).toBe('Payment of $450.00 was processed successfully.');
    expect(rendered.renderedEmail?.brandTheme?.primaryColor).toBe('#6366f1');
    expect(rendered.html).toBeDefined();
    expect(rendered.html).toContain('Invoice #INV-88291');
    expect(rendered.html).toContain('Sophia Miller');
    expect(rendered.html).toContain('$450.00');
    expect(rendered.html).toContain('Payment of $450.00 was processed successfully.');
  });
});
