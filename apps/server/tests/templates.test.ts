import { describe, expect, it } from 'bun:test';
import { I18nResolver } from '../src/modules/templates/i18n-resolver';
import { MjmlCompiler } from '../src/modules/templates/mjml-compiler';
import { TemplatesService } from '../src/modules/templates/templates.service';

describe('Content & Template Management Lifecycle Engine', () => {
  const testTenantId = '019ff136-0000-7000-8000-000000000001';
  const testTeam = 'engineering-test';

  describe('1. MJML Compiler', () => {
    it('compiles standard MJML tags into responsive HTML with CSS inlining', () => {
      const mjml = `
        <mjml>
          <mj-body>
            <mj-section background-color="#f0fdf4">
              <mj-column width="100%">
                <mj-text font-size="20px" color="#166534">Welcome to Convey</mj-text>
                <mj-button href="https://convey.dev" background-color="#22c55e">Verify Email</mj-button>
                <mj-divider border-color="#bbf7d0" />
              </mj-column>
            </mj-section>
          </mj-body>
        </mjml>
      `;

      const compiled = MjmlCompiler.compile(mjml, { title: 'Welcome' });
      expect(compiled).toContain('<!DOCTYPE html>');
      expect(compiled).toContain('Welcome to Convey');
      expect(compiled).toContain('https://convey.dev');
      expect(compiled).toContain('background-color: #22c55e');
      expect(compiled).toContain('Verify Email');
    });

    it('wraps raw HTML snippet safely in standards-compliant email shell', () => {
      const html = '<p>Simple paragraph message</p>';
      const wrapped = MjmlCompiler.compile(html, { title: 'Notification' });
      expect(wrapped).toContain('<!DOCTYPE html>');
      expect(wrapped).toContain('<p>Simple paragraph message</p>');
    });
  });

  describe('2. I18n Locale Fallback Resolver', () => {
    it('generates prioritized candidate locale keys', () => {
      const candidates = I18nResolver.getCandidateLocales('de-AT', 'en-US');
      expect(candidates).toContain('de-AT');
      expect(candidates).toContain('de');
      expect(candidates).toContain('en-US');
    });

    it('merges translated channel fields onto base configuration', () => {
      const baseConfig = {
        email: {
          subject: 'Order confirmation #{{orderId}}',
          html: '<p>Thank you for your order.</p>',
        },
        sms: {
          body: 'Order #{{orderId}} confirmed.',
        },
      };

      const translations = {
        'de-DE': {
          email: {
            subject: 'Bestellbestätigung #{{orderId}}',
            html: '<p>Vielen Dank für Ihre Bestellung.</p>',
          },
          sms: {
            body: 'Bestellung #{{orderId}} bestätigt.',
          },
        },
      };

      const result = I18nResolver.resolveLocalizedChannelConfig(baseConfig, translations, 'de-DE', 'en-US');

      expect(result.matchedLocale).toBe('de-DE');
      expect(result.resolvedConfig.email?.subject).toBe('Bestellbestätigung #{{orderId}}');
      expect(result.resolvedConfig.sms?.body).toBe('Bestellung #{{orderId}} bestätigt.');
    });

    it('falls back to base config when requested locale has no translation', () => {
      const baseConfig = {
        email: { subject: 'Base Subject' },
      };

      const result = I18nResolver.resolveLocalizedChannelConfig(baseConfig, {}, 'ja-JP', 'en-US');

      expect(result.matchedLocale).toBe('en-US');
      expect(result.resolvedConfig.email?.subject).toBe('Base Subject');
    });
  });

  describe('3. Templates Service Catalog & Partials', () => {
    const slug = `order_receipt_${Date.now()}`;

    it('creates a new template with initial published version and partials', async () => {
      // 1. Create a partial
      const partial = await TemplatesService.createOrUpdatePartial({
        tenantId: testTenantId,
        team: testTeam,
        name: 'brand_footer',
        content: '<p style="color: #6b7280;">Sent securely by Convey Platform</p>',
      });
      expect(partial.name).toBe('brand_footer');

      // 2. Create template with version 1.0.0
      const created = await TemplatesService.createTemplate({
        tenantId: testTenantId,
        team: testTeam,
        request: {
          slug,
          name: 'Order Receipt',
          description: 'Multi-channel order receipt notification',
          category: 'transactional',
          defaultLocale: 'en-US',
          initialVersion: {
            version: '1.0.0',
            channels: {
              email: {
                subject: 'Receipt for Order #{{orderId}}',
                mjml: `
                  <mjml>
                    <mj-body>
                      <mj-section>
                        <mj-column>
                          <mj-text>Your order for {{amount | currency: 'USD'}} is complete.</mj-text>
                          <mj-button href="{{receiptUrl}}">View Receipt</mj-button>
                        </mj-column>
                      </mj-section>
                    </mj-body>
                  </mjml>
                  {{> brand_footer }}
                `,
                text: 'Order #{{orderId}} completed for {{amount | currency: "USD"}}. {{> brand_footer }}',
              },
              sms: {
                body: 'Receipt for Order #{{orderId}}: {{receiptUrl}}',
              },
            },
            translations: {
              'es-ES': {
                email: {
                  subject: 'Recibo del Pedido #{{orderId}}',
                },
                sms: {
                  body: 'Recibo del Pedido #{{orderId}}: {{receiptUrl}}',
                },
              },
            },
            changeSummary: 'Initial production release',
          },
        },
      });

      expect(created.slug).toBe(slug);
      expect(created.publishedVersion?.version).toBe('1.0.0');

      // 3. Render English template
      const renderedEn = await TemplatesService.renderTemplate({
        tenantId: testTenantId,
        team: testTeam,
        request: {
          templateSlug: slug,
          channel: 'email',
          locale: 'en-US',
          variables: {
            orderId: 'ORD-9876',
            amount: 49.99,
            receiptUrl: 'https://convey.dev/receipts/9876',
          },
        },
      });

      expect(renderedEn.subject).toBe('Receipt for Order #ORD-9876');
      expect(renderedEn.html).toContain('$49.99');
      expect(renderedEn.html).toContain('Sent securely by Convey Platform');
      expect(renderedEn.resolvedPartials).toContain('brand_footer');

      // 4. Render Spanish locale translation
      const renderedEs = await TemplatesService.renderTemplate({
        tenantId: testTenantId,
        team: testTeam,
        request: {
          templateSlug: slug,
          channel: 'email',
          locale: 'es-ES',
          variables: {
            orderId: 'ORD-9876',
            amount: 49.99,
            receiptUrl: 'https://convey.dev/receipts/9876',
          },
        },
      });

      expect(renderedEs.subject).toBe('Recibo del Pedido #ORD-9876');
      expect(renderedEs.localeUsed).toBe('es-ES');
    });

    it('creates draft versions and allows atomic publishing', async () => {
      // Create version 1.1.0 draft
      const draft = await TemplatesService.createVersion({
        tenantId: testTenantId,
        team: testTeam,
        slug,
        request: {
          version: '1.1.0',
          channels: {
            sms: {
              body: 'Updated v1.1 SMS: Order #{{orderId}} ready.',
            },
          },
          publishImmediately: false,
        },
      });

      expect(draft.status).toBe('draft');

      // Publish version 1.1.0
      const published = await TemplatesService.publishVersion(testTenantId, testTeam, slug, '1.1.0');

      expect(published.publishedVersion?.version).toBe('1.1.0');
    });
  });
});
