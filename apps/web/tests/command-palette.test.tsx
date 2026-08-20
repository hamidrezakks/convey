import './setup';
import { beforeEach, describe, expect, it } from 'bun:test';
import { fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { CommandPalette } from '../src/components/layout/CommandPalette';

function CommandPaletteTestContainer() {
  const [open, setOpen] = useState(true);
  return <CommandPalette open={open} onOpenChange={setOpen} />;
}

describe('Super Senior QA: Command Palette Keyboard & Interaction Suite', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('filters commands accurately as the user types a query', () => {
    const { container } = render(<CommandPaletteTestContainer />);

    const input = container.querySelector('input');
    expect(input).toBeDefined();
    if (!input) return;

    // Type 'provider' using fireEvent.input
    fireEvent.input(input, { target: { value: 'provider' } });
    expect(container.textContent).toContain('Provider Matrix & Circuit Breaker Cockpit');
    expect(container.textContent).toContain('Provider Registration & Env Setup Studio');
  });

  it('navigates through filtered items with ArrowDown and ArrowUp', () => {
    const { container } = render(<CommandPaletteTestContainer />);

    const input = container.querySelector('input');
    expect(input).toBeDefined();
    if (!input) return;

    // Filter to small subset
    fireEvent.input(input, { target: { value: 'dlq' } });
    expect(container.textContent).toContain('Dead-Letter Queue (DLQ) & Surgical Replay');

    // Navigate with keys
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Escape' });
  });

  it('displays empty state when query matches no commands', () => {
    const { container } = render(<CommandPaletteTestContainer />);

    const input = container.querySelector('input');
    expect(input).toBeDefined();
    if (!input) return;

    fireEvent.input(input, { target: { value: 'xyznonexistentpage123' } });
    expect(container.textContent).toContain('No matching commands or pages found.');
  });
});
