import { describe, expect, it } from 'bun:test';
import { Channel } from '@convey/shared';
import { TemplatesService } from '../src/modules/templates/templates.service';

describe('Rich WhatsApp and Push Template Capabilities', () => {
  const tenantId = '019ff136-0000-7000-8000-000000000001';
  const team = 'qa-rich-channels';

  it('renders rich WhatsApp template with header, body variables, CTA buttons, and interactive lists', async () => {
    const rendered = await TemplatesService.renderTemplate({
      tenantId,
      team,
      request: {
        templateSpec: {
          whatsapp: {
            header: {
              type: 'image',
              mediaUrl: 'https://cdn.convey.dev/images/receipts/{{orderId}}.png',
            },
            body: 'Hello *{{recipient.name}}*, your order *#{{orderId}}* of {{itemsCount}} items is ready!',
            footer: 'Convey Logistics • Reply STOP to opt out',
            buttons: [
              {
                type: 'url',
                text: 'Track Order #{{orderId}} 🚚',
                url: 'https://track.convey.dev/{{orderId}}',
              },
              {
                type: 'copy_code',
                text: 'Copy PIN',
                code: '{{securityPin}}',
              },
            ],
            interactiveList: {
              buttonText: 'Options for {{recipient.name}} 📋',
              sections: [
                {
                  title: 'Delivery',
                  rows: [{ id: '1', title: 'Front Door', description: 'Porch code {{securityPin}}' }],
                },
              ],
            },
          },
        },
        channel: Channel.WHATSAPP,
        variables: {
          orderId: 'ORD-7712',
          itemsCount: 4,
          securityPin: '9481',
          recipient: { name: 'Elena Rostova' },
        },
      },
    });

    expect(rendered.channel).toBe(Channel.WHATSAPP);
    expect(rendered.body).toBe('Hello *Elena Rostova*, your order *#ORD-7712* of 4 items is ready!');
    expect(rendered.renderedWhatsApp).toBeDefined();
    expect(rendered.renderedWhatsApp?.header?.mediaUrl).toBe('https://cdn.convey.dev/images/receipts/ORD-7712.png');
    expect(rendered.renderedWhatsApp?.buttons?.[0].text).toBe('Track Order #ORD-7712 🚚');
    expect(rendered.renderedWhatsApp?.buttons?.[0].url).toBe('https://track.convey.dev/ORD-7712');
    expect(rendered.renderedWhatsApp?.buttons?.[1].code).toBe('9481');
    expect(rendered.renderedWhatsApp?.interactiveList?.buttonText).toBe('Options for Elena Rostova 📋');
    expect(rendered.renderedWhatsApp?.interactiveList?.sections[0].rows[0].description).toBe('Porch code 9481');
  });

  it('renders rich Push notification with title, subtitle, image banner, and interactive action buttons', async () => {
    const rendered = await TemplatesService.renderTemplate({
      tenantId,
      team,
      request: {
        templateSpec: {
          push: {
            title: 'Alert: {{alertType}} for {{recipient.name}}',
            subtitle: 'Severity: {{severity}}',
            body: 'Service {{serviceName}} is running at {{utilization}}% capacity.',
            imageUrl: 'https://cdn.convey.dev/graphs/{{serviceName}}.png',
            interruptionLevel: 'time-sensitive',
            clickActionUrl: 'convey://services/{{serviceName}}',
            actionButtons: [
              { id: 'btn_ack', title: 'Acknowledge {{alertType}} ✅' },
              { id: 'btn_escalate', title: 'Escalate to {{onCallLead}} 🚨' },
            ],
          },
        },
        channel: Channel.PUSH,
        variables: {
          alertType: 'High CPU Utilization',
          severity: 'P1-Critical',
          serviceName: 'ingress-gateway',
          utilization: 94.2,
          onCallLead: 'David',
          recipient: { name: 'Sarah' },
        },
      },
    });

    expect(rendered.channel).toBe(Channel.PUSH);
    expect(rendered.subject).toBe('Alert: High CPU Utilization for Sarah');
    expect(rendered.body).toBe('Service ingress-gateway is running at 94.2% capacity.');
    expect(rendered.renderedPush).toBeDefined();
    expect(rendered.renderedPush?.subtitle).toBe('Severity: P1-Critical');
    expect(rendered.renderedPush?.imageUrl).toBe('https://cdn.convey.dev/graphs/ingress-gateway.png');
    expect(rendered.renderedPush?.clickActionUrl).toBe('convey://services/ingress-gateway');
    expect(rendered.renderedPush?.actionButtons?.[0].title).toBe('Acknowledge High CPU Utilization ✅');
    expect(rendered.renderedPush?.actionButtons?.[1].title).toBe('Escalate to David 🚨');
  });
});
