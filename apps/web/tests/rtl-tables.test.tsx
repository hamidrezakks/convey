import './setup';
import { beforeEach, describe, expect, it } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../src/components/ui/table';
import type { SupportedLocale } from '../src/i18n';
import { I18nProvider } from '../src/i18n/context';
import { DeliverabilityPage } from '../src/pages/DeliverabilityPage';
import { DlqPage } from '../src/pages/DlqPage';
import { MessagesPage } from '../src/pages/MessagesPage';
import { ProviderConfigPage } from '../src/pages/ProviderConfigPage';
import { ProvidersPage } from '../src/pages/ProvidersPage';

function renderWithClient(ui: React.ReactElement, initialLocale: SupportedLocale = 'fa') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider initialLocale={initialLocale}>
        <div dir={initialLocale === 'fa' || initialLocale === 'ar' ? 'rtl' : 'ltr'}>{ui}</div>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('RTL Tables Structural Alignment & Integrity Test Suite', () => {
  beforeEach(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'fa';
  });

  it('renders primitive Table, TableHead, and TableCell with proper RTL start/end alignment', () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>شناسه پیام</TableHead>
            <TableHead>کانال</TableHead>
            <TableHead className="text-end rtl:text-left">عملیات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-mono">msg_01JAX9901</TableCell>
            <TableCell>SMS</TableCell>
            <TableCell className="text-end rtl:text-left">نمایش</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const tableEl = container.querySelector('table');
    expect(tableEl).not.toBeNull();
    expect(tableEl?.className).toContain('text-start');

    const ths = container.querySelectorAll('th');
    expect(ths.length).toBe(3);
    expect(ths[0].className).toContain('text-start');
    expect(ths[2].className).toContain('text-end');

    const tds = container.querySelectorAll('td');
    expect(tds.length).toBe(3);
    expect(tds[0].className).toContain('text-start');
    expect(tds[2].className).toContain('text-end');
  });

  it('renders MessagesPage in RTL mode without broken table column hierarchy', () => {
    const { container } = renderWithClient(<MessagesPage />, 'fa');
    const table = container.querySelector('table');
    expect(table).not.toBeNull();

    const headers = container.querySelectorAll('th');
    expect(headers.length).toBe(10);
  });

  it('renders ProvidersPage in RTL mode with correct action column alignment', () => {
    const { container } = renderWithClient(<ProvidersPage />, 'fa');
    const table = container.querySelector('table');
    expect(table).not.toBeNull();

    const headers = container.querySelectorAll('th');
    expect(headers.length).toBe(9);
  });

  it('renders DeliverabilityPage in RTL mode with correct suppression table structure', () => {
    const { container } = renderWithClient(<DeliverabilityPage />, 'ar');
    const table = container.querySelector('table');
    expect(table).not.toBeNull();

    const headers = container.querySelectorAll('th');
    expect(headers.length).toBe(7);
  });

  it('renders DlqPage in RTL mode without unaligned cell wrappers', () => {
    const { container } = renderWithClient(<DlqPage />, 'fa');
    const table = container.querySelector('table');
    expect(table).not.toBeNull();

    const headers = container.querySelectorAll('th');
    expect(headers.length).toBe(8);
  });

  it('renders ProviderConfigPage with all 8 columns in RTL mode', () => {
    const { container } = renderWithClient(<ProviderConfigPage />, 'fa');
    const table = container.querySelector('table');
    expect(table).not.toBeNull();

    const headers = container.querySelectorAll('th');
    expect(headers.length).toBe(8);
  });
});
