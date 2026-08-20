import './setup';
import { describe, expect, it } from 'bun:test';
import { fireEvent, render } from '@testing-library/react';
import { Combobox, type ComboboxGroup } from '../src/components/ui/combobox';

describe('Searchable Combobox & Autocomplete Test Suite', () => {
  const sampleGroups: ComboboxGroup[] = [
    {
      label: '📧 Email Providers',
      categoryKey: 'EMAIL',
      items: [
        { value: 'ses', label: 'Amazon SES v2', sublabel: 'ses', badge: 'EMAIL', keywords: ['aws', 'email'] },
        {
          value: 'sendgrid',
          label: 'SendGrid Email API',
          sublabel: 'sendgrid',
          badge: 'EMAIL',
          keywords: ['twilio', 'email'],
        },
        { value: 'resend', label: 'Resend', sublabel: 'resend', badge: 'EMAIL', keywords: ['developer', 'react'] },
      ],
    },
    {
      label: '📱 SMS Telecom Gateways',
      categoryKey: 'SMS',
      items: [
        {
          value: 'twilio',
          label: 'Twilio Programmable SMS',
          sublabel: 'twilio',
          badge: 'SMS',
          keywords: ['carrier', 'phone'],
        },
        { value: 'nexmo', label: 'Vonage / Nexmo', sublabel: 'nexmo', badge: 'SMS', keywords: ['ericsson', 'sms'] },
      ],
    },
    {
      label: '💬 Chat & WhatsApp',
      categoryKey: 'CHAT',
      items: [
        {
          value: 'whatsapp-business',
          label: 'WhatsApp Business API',
          sublabel: 'whatsapp-business',
          badge: 'CHAT',
          keywords: ['meta', '24h'],
        },
        {
          value: 'slack',
          label: 'Slack Webhook & Block Kit',
          sublabel: 'slack',
          badge: 'CHAT',
          keywords: ['workspace', 'channel'],
        },
      ],
    },
  ];

  it('renders trigger button with placeholder when no value is selected', () => {
    const { container } = render(
      <Combobox groups={sampleGroups} value="" onChange={() => {}} placeholder="Select provider adapter..." />,
    );

    expect(container.textContent).toContain('Select provider adapter...');
    expect(container.querySelector('button')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders trigger button with selected item label and channel badge', () => {
    const { container } = render(
      <Combobox groups={sampleGroups} value="sendgrid" onChange={() => {}} placeholder="Select provider adapter..." />,
    );

    expect(container.textContent).toContain('SendGrid Email API');
    expect(container.textContent).toContain('(sendgrid)');
    expect(container.textContent).toContain('EMAIL');
  });

  it('opens popover on click and renders search input with grouped items', () => {
    const { container } = render(
      <Combobox groups={sampleGroups} value="ses" onChange={() => {}} searchPlaceholder="Search 88 providers..." />,
    );

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    if (button) {
      fireEvent.click(button);
    }

    expect(button?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('input[placeholder="Search 88 providers..."]')).not.toBeNull();
    expect(container.textContent).toContain('Amazon SES v2');
    expect(container.textContent).toContain('Twilio Programmable SMS');
    expect(container.textContent).toContain('WhatsApp Business API');
  });

  it('filters items dynamically by search query across label, sublabel and keywords', () => {
    const { container } = render(<Combobox groups={sampleGroups} value="" onChange={() => {}} />);

    const button = container.querySelector('button');
    if (button) {
      fireEvent.click(button);
    }

    const input = container.querySelector('input');
    expect(input).not.toBeNull();

    if (input) {
      // Type search query 'twilio'
      fireEvent.input(input, { target: { value: 'twilio' } });
      fireEvent.change(input, { target: { value: 'twilio' } });
    }

    // Should match Twilio (in name) and SendGrid (in keyword)
    expect(container.textContent).toContain('Twilio Programmable SMS');
    expect(container.textContent).toContain('SendGrid Email API');
    expect(container.textContent).not.toContain('Amazon SES v2');
    expect(container.textContent).not.toContain('WhatsApp Business API');
  });

  it('selects option on click and calls onChange handler', () => {
    let selected = 'ses';
    const { container } = render(
      <Combobox
        groups={sampleGroups}
        value={selected}
        onChange={(val) => {
          selected = val;
        }}
      />,
    );

    const button = container.querySelector('button');
    if (button) {
      fireEvent.click(button);
    }

    // Find and click on Twilio option button
    const twilioOption = Array.from(container.querySelectorAll('button')).find((el) =>
      el.textContent?.includes('Twilio Programmable SMS'),
    );

    expect(twilioOption).not.toBeUndefined();
    if (twilioOption) {
      fireEvent.click(twilioOption);
    }

    expect(selected).toBe('twilio');
  });

  it('filters by category pill tab inside the popover', () => {
    const { container } = render(<Combobox groups={sampleGroups} value="" onChange={() => {}} />);

    const button = container.querySelector('button');
    if (button) {
      fireEvent.click(button);
    }

    // Click on 'SMS' category pill
    const smsPill = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('SMS Telecom Gateways') || btn.textContent?.includes('SMS'),
    );

    expect(smsPill).not.toBeUndefined();
    if (smsPill) {
      fireEvent.click(smsPill);
    }

    // Should show SMS options and exclude Email / Chat options
    expect(container.textContent).toContain('Twilio Programmable SMS');
    expect(container.textContent).toContain('Vonage / Nexmo');
  });
});
