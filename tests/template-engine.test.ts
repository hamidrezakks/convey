import { describe, expect, it } from 'bun:test';
import { app } from '../src/index';
import { TemplateEngine } from '../src/modules/messaging/template-engine';

describe('Zero-Allocation Template Engine', () => {
  it('should interpolate variables and nested properties correctly', () => {
    const template = 'Hello {{ user.name }}, your order {{ order.id }} is confirmed!';
    const context = {
      user: { name: 'Alice' },
      order: { id: 'ORD-1234' },
    };
    const result = TemplateEngine.compile(template, context);
    expect(result).toBe('Hello Alice, your order ORD-1234 is confirmed!');
  });

  it('should apply filters and formatting chain correctly', () => {
    const template =
      'User: {{ user.name | uppercase }} | Total: {{ total | currency: "USD" }} | Tier: {{ tier | default: "STANDARD" }}';
    const context = {
      user: { name: 'john doe' },
      total: 149.5,
      tier: '',
    };
    const result = TemplateEngine.compile(template, context);
    expect(result).toBe('User: JOHN DOE | Total: $149.50 | Tier: STANDARD');
  });

  it('should evaluate conditional blocks properly', () => {
    const template =
      '{% if is_vip %}VIP Welcome Back, {{ name }}!{% else %}Welcome {{ name }}!{% endif %} | {% if has_discount %}Discount: {{ discount }}%{% endif %}';

    const vipContext = { is_vip: true, name: 'Bob', has_discount: true, discount: 20 };
    const vipResult = TemplateEngine.compile(template, vipContext);
    expect(vipResult).toBe('VIP Welcome Back, Bob! | Discount: 20%');

    const regularContext = { is_vip: false, name: 'Charlie', has_discount: false };
    const regularResult = TemplateEngine.compile(template, regularContext);
    expect(regularResult).toBe('Welcome Charlie! | ');
  });

  it('should render TemplateSpec and generate responsive HTML email wrapper', () => {
    const templateSpec = {
      subject: 'Security Alert for {{ recipient.email }}',
      body: '<p>A new login was detected from {{ location }}.</p>',
      html: '<h1>Security Notice</h1><p>Location: {{ location }}</p>',
    };
    const variables = { location: 'San Francisco, CA' };
    const recipient = { email: 'security@example.com' };

    const rendered = TemplateEngine.render(templateSpec, variables, recipient);
    expect(rendered.subject).toBe('Security Alert for security@example.com');
    expect(rendered.body).toBe('<p>A new login was detected from San Francisco, CA.</p>');
    expect(rendered.html).toContain('<!DOCTYPE html>');
    expect(rendered.html).toContain('Location: San Francisco, CA');
    expect(rendered.html).toContain('email-container');
  });

  it('should support preview endpoint via POST /v1/messages/templates/preview', async () => {
    const res = await app.handle(
      new Request('http://localhost/v1/messages/templates/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: {
            subject: 'Invoice #{{ invoiceId }}',
            body: 'Dear {{ name }}, your balance of {{ amount | currency: "USD" }} is due.',
          },
          variables: {
            invoiceId: 'INV-5501',
            name: 'Acme Corp',
            amount: 1200.0,
          },
        }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { subject: string; body: string };
    expect(body.subject).toBe('Invoice #INV-5501');
    expect(body.body).toBe('Dear Acme Corp, your balance of $1200.00 is due.');
  });
});
