import './setup';
import { beforeEach, describe, expect, it } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render } from '@testing-library/react';
import { ComposerPage } from '../src/pages/ComposerPage';

function renderComposerWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ComposerPage />
    </QueryClientProvider>,
  );
}

describe('Super Senior QA: Composer & Dynamic Preview Interaction Suite', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('updates dynamic variables in real-time and warns on syntax errors', () => {
    const { container } = renderComposerWithClient();

    // Default variable should interpolate in preview
    expect(container.textContent).toContain('Alex Rivera');

    // Find variables textarea (second textarea on the page)
    const textareas = container.querySelectorAll('textarea');
    const variablesTextarea = textareas[1] as HTMLTextAreaElement;
    expect(variablesTextarea).toBeDefined();

    // Type invalid JSON
    fireEvent.input(variablesTextarea, { target: { value: '{ badJson: invalid }' } });

    // Warning message should be visible
    expect(container.textContent).toContain('Invalid JSON');

    // Restore valid JSON with a new variable
    fireEvent.input(variablesTextarea, {
      target: {
        value: JSON.stringify({ customerName: 'Cyberdyne Systems', authCode: '999888' }),
      },
    });

    // Warning message should disappear and new customer name should render
    expect(container.textContent).not.toContain('Invalid JSON');
    expect(container.textContent).toContain('Cyberdyne Systems');
  });

  it('allows changing recipient, subject, and body with live updates', () => {
    const { container } = renderComposerWithClient();

    const inputs = container.querySelectorAll('input');
    const recipientInput = inputs[0] as HTMLInputElement;
    const subjectInput = inputs[1] as HTMLInputElement;

    fireEvent.input(recipientInput, { target: { value: 'john.wick@continental.com' } });
    fireEvent.input(subjectInput, { target: { value: 'Welcome to Convey Continental' } });

    expect(container.textContent).toContain('Welcome to Convey Continental');
    expect(container.textContent).toContain('john.wick@continental.com');
  });
});
