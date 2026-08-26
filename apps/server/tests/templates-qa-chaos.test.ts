import { describe, expect, it } from 'bun:test';
import { Channel } from '@convey/shared';
import { I18nResolver } from '../src/modules/templates/i18n-resolver';
import { MjmlCompiler } from '../src/modules/templates/mjml-compiler';
import { TemplatesService } from '../src/modules/templates/templates.service';

describe('QA Chaos & Resiliency: Templates & MJML Engine', () => {
  const tenantId = '019ff136-0000-7000-8000-000000000001';
  const team = 'qa-stress-team';

  describe('1. MJML Compiler Malformed & Chaos Recovery', () => {
    it('gracefully handles empty, unclosed, or invalid MJML syntax without throwing fatal errors', () => {
      // Empty input
      const emptyHtml = MjmlCompiler.compile('<mjml><mj-body></mj-body></mjml>');
      expect(emptyHtml).toContain('<!DOCTYPE html>');

      // Malformed tags (unclosed tag)
      const malformedMjml = '<mjml><mj-body><mj-text color="#ff0000">Broken unclosed body';
      const output = MjmlCompiler.compile(malformedMjml);
      expect(output).toContain('Broken unclosed body');
      expect(output).toContain('<!DOCTYPE html>');
    });

    it('compiles nested columns, buttons, and responsive styles at high concurrency', async () => {
      const complexMjml = `
        <mjml>
          <mj-body background-color="#0f172a">
            <mj-section>
              <mj-column width="50%">
                <mj-text font-size="18px" font-weight="700" color="#38bdf8">Convey Global Ingestion</mj-text>
                <mj-button href="https://convey.dev/status" background-color="#0284c7">View SLA</mj-button>
              </mj-column>
              <mj-column width="50%">
                <mj-text font-size="14px" color="#94a3b8">Sub-millisecond outbox replication.</mj-text>
              </mj-column>
            </mj-section>
            <mj-divider border-color="#334155" />
          </mj-body>
        </mjml>
      `;

      // 500 concurrent compilations
      const promises = Array.from({ length: 500 }, () => Promise.resolve(MjmlCompiler.compile(complexMjml)));
      const results = await Promise.all(promises);

      expect(results.length).toBe(500);
      for (const res of results) {
        expect(res).toContain('Convey Global Ingestion');
        expect(res).toContain('https://convey.dev/status');
      }
    });
  });

  describe('2. Deep Hierarchical i18n Resolution & Fallback Chains', () => {
    it('correctly resolves multi-segment locales down to primary and root defaults', () => {
      const config = {
        email: { subject: 'Global Default' },
      };

      const translations = {
        de: { email: { subject: 'Guten Tag (German Base)' } },
        'de-AT': { email: { subject: 'Servus (Austrian Variant)' } },
        'de-CH-1996': { email: { subject: 'Grüezi (Swiss Variant)' } },
        fr: { email: { subject: 'Bonjour (French Base)' } },
      };

      // Exact match
      const resAustrian = I18nResolver.resolve(config, translations, 'de-AT', 'en-US');
      expect(resAustrian.email?.subject).toBe('Servus (Austrian Variant)');

      // Sub-tag fallback (de-DE falls back to de)
      const resGerman = I18nResolver.resolve(config, translations, 'de-DE', 'en-US');
      expect(resGerman.email?.subject).toBe('Guten Tag (German Base)');

      // Non-existent language falls back to root default
      const resJapanese = I18nResolver.resolve(config, translations, 'ja-JP', 'en-US');
      expect(resJapanese.email?.subject).toBe('Global Default');
    });
  });

  describe('3. Template Partials & Variable Interpolation Stress', () => {
    it('resolves partials and custom handlebars-style filters reliably', async () => {
      // 1. Create a partial
      await TemplatesService.createOrUpdatePartial({
        tenantId,
        team,
        name: 'qa_legal_footer',
        content: '<p class="legal">© 2026 {{companyName}}. All rights reserved.</p>',
      });

      // 2. Render template referencing partial
      const rendered = await TemplatesService.renderTemplate({
        tenantId,
        team,
        request: {
          templateSpec: {
            email: {
              subject: 'Invoice for {{userName | upper}}',
              html: '<div>Dear {{userName}}, here is your receipt: {{> qa_legal_footer}}</div>',
            },
          },
          channel: Channel.EMAIL,
          variables: {
            userName: 'Alex Mercer',
            companyName: 'Acme Corporation',
          },
        },
      });

      expect(rendered.subject).toBe('Invoice for ALEX MERCER');
      expect(rendered.html).toContain('© 2026 Acme Corporation. All rights reserved.');
      expect(rendered.resolvedPartials).toContain('qa_legal_footer');
    });
  });
});
