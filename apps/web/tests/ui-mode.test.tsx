import './setup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type React from 'react';
import { I18nProvider } from '../src/i18n';
import { EngineerOnly, ModeRenderer, OpsOnly, UiModeProvider, UiModeSwitcher, useUiMode } from '../src/mode';
import { ComposerPage } from '../src/pages/ComposerPage';
import { DeliverabilityPage } from '../src/pages/DeliverabilityPage';
import { DlqPage } from '../src/pages/DlqPage';
import { MessagesPage } from '../src/pages/MessagesPage';
import { OverviewPage } from '../src/pages/OverviewPage';
import { PoliciesPage } from '../src/pages/PoliciesPage';
import { ProvidersPage } from '../src/pages/ProvidersPage';
import { ThemeProvider } from '../src/theme';

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/overview' }),
  Link: ({ children, to, className, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
    <a href={to} className={className} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({
    navigate: vi.fn(),
    state: { location: { pathname: '/overview' } },
  }),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function TestWrapper({
  children,
  defaultMode = 'engineer',
}: {
  children: React.ReactNode;
  defaultMode?: 'engineer' | 'ops';
}) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider initialLocale="en">
        <ThemeProvider defaultTheme="dark">
          <UiModeProvider defaultMode={defaultMode}>{children}</UiModeProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe('Convey Dual-Mode UI System (Engineering Mode vs Operations Mode)', () => {
  beforeEach(() => {
    cleanup();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  describe('UiModeProvider & useUiMode Hook', () => {
    function ModeConsumer() {
      const { mode, isEngineer, isOps, toggleMode, setMode } = useUiMode();
      return (
        <div>
          <span data-testid="mode-display">{mode}</span>
          <span data-testid="is-engineer">{isEngineer ? 'true' : 'false'}</span>
          <span data-testid="is-ops">{isOps ? 'true' : 'false'}</span>
          <button type="button" onClick={toggleMode} data-testid="toggle-btn">
            Toggle
          </button>
          <button type="button" onClick={() => setMode('ops')} data-testid="set-ops-btn">
            Set Ops
          </button>
          <button type="button" onClick={() => setMode('engineer')} data-testid="set-eng-btn">
            Set Eng
          </button>
        </div>
      );
    }

    it('initializes with default engineering mode when no localStorage value is present', () => {
      const { getByTestId } = render(
        <TestWrapper defaultMode="engineer">
          <ModeConsumer />
        </TestWrapper>,
      );

      expect(getByTestId('mode-display').textContent).toBe('engineer');
      expect(getByTestId('is-engineer').textContent).toBe('true');
      expect(getByTestId('is-ops').textContent).toBe('false');
    });

    it('restores persisted ops mode preference from localStorage on mount', () => {
      localStorage.setItem('convey_ui_mode', 'ops');

      const { getByTestId } = render(
        <TestWrapper>
          <ModeConsumer />
        </TestWrapper>,
      );

      expect(getByTestId('mode-display').textContent).toBe('ops');
      expect(getByTestId('is-engineer').textContent).toBe('false');
      expect(getByTestId('is-ops').textContent).toBe('true');
    });

    it('toggles mode and persists to localStorage', () => {
      const { getByTestId } = render(
        <TestWrapper defaultMode="engineer">
          <ModeConsumer />
        </TestWrapper>,
      );

      const toggleBtn = getByTestId('toggle-btn');
      fireEvent.click(toggleBtn);

      expect(getByTestId('mode-display').textContent).toBe('ops');
      expect(localStorage.getItem('convey_ui_mode')).toBe('ops');

      fireEvent.click(toggleBtn);
      expect(getByTestId('mode-display').textContent).toBe('engineer');
      expect(localStorage.getItem('convey_ui_mode')).toBe('engineer');
    });

    it('toggles mode via Shift + E keyboard shortcut', async () => {
      const { getByTestId } = render(
        <TestWrapper defaultMode="engineer">
          <ModeConsumer />
        </TestWrapper>,
      );

      expect(getByTestId('mode-display').textContent).toBe('engineer');

      // Dispatch Shift + E
      fireEvent.keyDown(window, { key: 'E', shiftKey: true });

      await waitFor(() => {
        expect(getByTestId('mode-display').textContent).toBe('ops');
      });

      // Dispatch Shift + E again
      fireEvent.keyDown(window, { key: 'E', shiftKey: true });

      await waitFor(() => {
        expect(getByTestId('mode-display').textContent).toBe('engineer');
      });
    });
  });

  describe('ModeRenderer & Declarative Gates (<EngineerOnly>, <OpsOnly>)', () => {
    it('renders EngineerOnly content only in engineering mode', () => {
      const engRender = render(
        <TestWrapper defaultMode="engineer">
          <EngineerOnly>
            <div data-testid="eng-content">W3C Distributed Trace & Queue Depth</div>
          </EngineerOnly>
          <OpsOnly>
            <div data-testid="ops-content">Business Delivery Journey</div>
          </OpsOnly>
        </TestWrapper>,
      );

      expect(engRender.queryByTestId('eng-content')).toBeTruthy();
      expect(engRender.queryByTestId('ops-content')).toBeNull();

      engRender.unmount();

      const opsRender = render(
        <TestWrapper defaultMode="ops">
          <EngineerOnly>
            <div data-testid="eng-content">W3C Distributed Trace & Queue Depth</div>
          </EngineerOnly>
          <OpsOnly>
            <div data-testid="ops-content">Business Delivery Journey</div>
          </OpsOnly>
        </TestWrapper>,
      );

      expect(opsRender.queryByTestId('eng-content')).toBeNull();
      expect(opsRender.queryByTestId('ops-content')).toBeTruthy();
      opsRender.unmount();
    });

    it('ModeRenderer renders appropriate branch for active mode', () => {
      const { getByTestId } = render(
        <TestWrapper defaultMode="ops">
          <ModeRenderer
            engineer={<div>Engineering Telemetry</div>}
            ops={<div data-testid="ops-render">Operations Summary</div>}
          />
        </TestWrapper>,
      );

      expect(getByTestId('ops-render')).toBeTruthy();
    });
  });

  describe('UiModeSwitcher Component', () => {
    it('renders segmented mode toggle and switches mode on click', () => {
      const { getByRole } = render(
        <TestWrapper defaultMode="engineer">
          <UiModeSwitcher variant="navbar" />
        </TestWrapper>,
      );

      const opsBtn = getByRole('button', { name: /operations|ops/i });
      fireEvent.click(opsBtn);

      expect(localStorage.getItem('convey_ui_mode')).toBe('ops');
    });

    it('renders card variant with shortcut hint', () => {
      const { getByText } = render(
        <TestWrapper defaultMode="engineer">
          <UiModeSwitcher variant="card" />
        </TestWrapper>,
      );

      expect(getByText('Workspace View Mode')).toBeTruthy();
      expect(getByText('Shift + E')).toBeTruthy();
    });
  });

  describe('Polymorphic Page Rendering in Ops vs Engineer Mode', () => {
    it('renders OverviewPage with simplified health summary in Ops mode', () => {
      const { getAllByText } = render(
        <TestWrapper defaultMode="ops">
          <OverviewPage />
        </TestWrapper>,
      );

      expect(getAllByText(/100% Operational/i).length).toBeGreaterThanOrEqual(1);
      expect(getAllByText(/All Systems Normal/i).length).toBeGreaterThanOrEqual(1);
    });

    it('renders OverviewPage with deep queue depths and latency telemetry in Engineer mode', () => {
      const { getByText } = render(
        <TestWrapper defaultMode="engineer">
          <OverviewPage />
        </TestWrapper>,
      );

      expect(getByText(/outbox-relay/i)).toBeTruthy();
      expect(getByText(/message-dispatch/i)).toBeTruthy();
      expect(getByText(/provider-send/i)).toBeTruthy();
    });

    it('renders MessagesPage in Ops mode without raw traceparent column', () => {
      const { queryByText } = render(
        <TestWrapper defaultMode="ops">
          <MessagesPage />
        </TestWrapper>,
      );

      expect(queryByText('Public ID')).toBeNull();
    });

    it('renders MessagesPage in Engineer mode with Public ID header', () => {
      const { getByText } = render(
        <TestWrapper defaultMode="engineer">
          <MessagesPage />
        </TestWrapper>,
      );

      expect(getByText('Public ID')).toBeTruthy();
    });

    it('renders ProvidersPage in Ops mode with active channel cards', () => {
      const { getByText } = render(
        <TestWrapper defaultMode="ops">
          <ProvidersPage />
        </TestWrapper>,
      );

      expect(getByText(/Email Delivery/i)).toBeTruthy();
      expect(getByText(/SMS & Telecom/i)).toBeTruthy();
    });

    it('renders DlqPage with reassurance banner in Ops mode', () => {
      const { getByText } = render(
        <TestWrapper defaultMode="ops">
          <DlqPage />
        </TestWrapper>,
      );

      expect(getByText(/Zero Data Loss Guarantee/i)).toBeTruthy();
    });

    it('renders DeliverabilityPage in Ops mode with friendly unblock action', () => {
      const { getByText } = render(
        <TestWrapper defaultMode="ops">
          <DeliverabilityPage />
        </TestWrapper>,
      );

      expect(getByText(/Blocked Contacts List/i)).toBeTruthy();
    });

    it('renders PoliciesPage with WhatsApp and Quiet Hours in Ops mode', () => {
      const { getByText } = render(
        <TestWrapper defaultMode="ops">
          <PoliciesPage />
        </TestWrapper>,
      );

      expect(getByText(/WhatsApp Cost Optimizer/i)).toBeTruthy();
      expect(getByText(/Quiet Hours Protection/i)).toBeTruthy();
    });

    it('renders ComposerPage with variable insertion chips in Ops mode', () => {
      const { getByText } = render(
        <TestWrapper defaultMode="ops">
          <ComposerPage />
        </TestWrapper>,
      );

      expect(getByText(/Insert Customer Variable:/i)).toBeTruthy();
    });
  });
});
