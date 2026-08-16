import './setup';
import { describe, expect, it } from 'bun:test';
import { Channel } from '@convey/shared';
import { render } from '@testing-library/react';
import { OmnichannelPreview } from '../src/components/composer/OmnichannelPreview';

describe('Omnichannel Template Engine & Preview Test Suite', () => {
  it('interpolates template variables across HTML and text templates', () => {
    const { container } = render(
      <OmnichannelPreview
        channel={Channel.EMAIL}
        recipient="alice@test.com"
        subject="Welcome {{name}}!"
        body="<p>Your code is {{code}}.</p>"
        variables={{ name: 'Alice', code: '91823' }}
      />,
    );

    expect(container.textContent).toContain('Welcome Alice!');
    expect(container.textContent).toContain('Your code is 91823.');
  });

  it('calculates SMS GSM-7 character length and segment count', () => {
    const shortText = 'Your verification code is 123456';
    const { container, rerender } = render(
      <OmnichannelPreview channel={Channel.SMS} recipient="+15550192831" body={shortText} />,
    );

    expect(container.textContent).toContain(`${shortText.length} chars`);
    expect(container.textContent).toContain('1 segment');

    // Long SMS over 160 characters
    const longText = 'A'.repeat(200);
    rerender(<OmnichannelPreview channel={Channel.SMS} recipient="+15550192831" body={longText} />);
    expect(container.textContent).toContain('200 chars');
    expect(container.textContent).toContain('2 segments');
  });

  it('renders WhatsApp channel with quick action buttons', () => {
    const { container } = render(
      <OmnichannelPreview channel={Channel.WHATSAPP} recipient="+15550192831" body="Order shipped!" />,
    );

    expect(container.textContent).toContain('Convey Verified');
    expect(container.textContent).toContain('Order shipped!');
    expect(container.textContent).toContain('Track Shipment');
  });

  it('renders Slack block card format', () => {
    const { container } = render(
      <OmnichannelPreview
        channel={Channel.SLACK}
        recipient="#alerts"
        subject="Cluster Alert"
        body="High CPU load detected."
      />,
    );

    expect(container.textContent).toContain('Convey Bot');
    expect(container.textContent).toContain('Cluster Alert');
    expect(container.textContent).toContain('High CPU load detected.');
  });
});
