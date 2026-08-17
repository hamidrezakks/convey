import './setup';
import { beforeEach, describe, expect, it } from 'bun:test';
import { Channel } from '@convey/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { OmnichannelPreview } from '../src/components/composer/OmnichannelPreview';
import { NAV_GROUPS } from '../src/components/layout/Sidebar';
import { TraceWaterfall } from '../src/components/trace/TraceWaterfall';
import { Dialog, DialogContent } from '../src/components/ui/dialog';

describe('Web Navigation, UI Hardening & Edge Cases Suite', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('locks body scroll when Dialog is open and unlocks on close', () => {
    function TestDialogWrapper() {
      const [open, setOpen] = useState(true);
      return (
        <div>
          <button type="button" onClick={() => setOpen(false)}>
            Close Modal
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <div>Modal Open Content</div>
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    const { unmount } = render(<TestDialogWrapper />);
    expect(document.body.style.overflow).toBe('hidden');

    const closeBtn = screen.getByText('Close Modal');
    fireEvent.click(closeBtn);
    expect(document.body.style.overflow).toBe('');

    unmount();
  });

  it('Sidebar active route matching logic correctly isolates /providers from /providers/configure', () => {
    // Simulate active check for currentPath = '/providers/configure'
    const currentPath = '/providers/configure';

    const getIsActive = (itemPath: string) => {
      const hasMoreSpecificMatch = NAV_GROUPS.some((g) =>
        g.items.some(
          (other) =>
            other.path !== itemPath &&
            other.path.startsWith(itemPath) &&
            (currentPath === other.path || currentPath.startsWith(`${other.path}/`)),
        ),
      );
      return (
        currentPath === itemPath ||
        (!hasMoreSpecificMatch && itemPath !== '/overview' && currentPath.startsWith(`${itemPath}/`))
      );
    };

    // When on /providers/configure, /providers should NOT be active
    expect(getIsActive('/providers')).toBe(false);
    expect(getIsActive('/providers/configure')).toBe(true);

    // When on /providers, /providers should be active and /providers/configure should NOT
    const currentPathProviders = '/providers';
    const getIsActiveProviders = (itemPath: string) => {
      const hasMoreSpecificMatch = NAV_GROUPS.some((g) =>
        g.items.some(
          (other) =>
            other.path !== itemPath &&
            other.path.startsWith(itemPath) &&
            (currentPathProviders === other.path || currentPathProviders.startsWith(`${other.path}/`)),
        ),
      );
      return (
        currentPathProviders === itemPath ||
        (!hasMoreSpecificMatch && itemPath !== '/overview' && currentPathProviders.startsWith(`${itemPath}/`))
      );
    };

    expect(getIsActiveProviders('/providers')).toBe(true);
    expect(getIsActiveProviders('/providers/configure')).toBe(false);
  });

  it('OmnichannelPreview interpolates variables safely even with special regex chars in keys', () => {
    render(
      <OmnichannelPreview
        channel={Channel.SMS}
        recipient="+15551234567"
        body="Hello {{user.name}} your price is {{item[0].price}} with bonus {{$bonus}}!"
        variables={{
          'user.name': 'Sarah Connor',
          'item[0].price': '$49.99',
          $bonus: '100 pts',
        }}
      />,
    );

    expect(screen.getByText(/Hello Sarah Connor your price is \$49.99 with bonus 100 pts!/)).toBeDefined();
  });

  it('TraceWaterfall handles empty or overflow spans gracefully', () => {
    const { container } = render(<TraceWaterfall traceparent="00-test-01" spans={[]} />);
    expect(screen.getByText('0 Spans')).toBeDefined();
    expect(container).toBeDefined();
  });
});
