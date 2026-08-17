import './setup';
import { beforeEach, describe, expect, it } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook } from '@testing-library/react';
import type React from 'react';
import { CommandPalette } from '../src/components/layout/CommandPalette';
import { Navbar } from '../src/components/layout/Navbar';
import { I18nProvider } from '../src/i18n/context';
import { ArchitecturePage } from '../src/pages/ArchitecturePage';
import { AuditPage } from '../src/pages/AuditPage';
import { ComposerPage } from '../src/pages/ComposerPage';
import { DeliverabilityPage } from '../src/pages/DeliverabilityPage';
import { DlqPage } from '../src/pages/DlqPage';
import { MessagesPage } from '../src/pages/MessagesPage';
import { OverviewPage } from '../src/pages/OverviewPage';
import { PoliciesPage } from '../src/pages/PoliciesPage';
import { ProviderConfigPage } from '../src/pages/ProviderConfigPage';
import { ProvidersPage } from '../src/pages/ProvidersPage';
import { WebhooksPage } from '../src/pages/WebhooksPage';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { ThemeSwitcher } from '../src/theme/ThemeSwitcher';

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

function renderWithProviders(ui: React.ReactElement, initialTheme: 'light' | 'dark' | 'system' = 'dark') {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider initialLocale="en">
        <ThemeProvider defaultTheme={initialTheme}>{ui}</ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('Convey Enterprise Theme Subsystem & System Preference Suite', () => {
  let mediaQueryListeners: Array<(e: { matches: boolean }) => void> = [];
  let currentMatchesDark = false;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    mediaQueryListeners = [];
    currentMatchesDark = false;

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: currentMatchesDark,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: (_event: string, listener: (e: { matches: boolean }) => void) => {
          mediaQueryListeners.push(listener);
        },
        removeEventListener: (_event: string, listener: (e: { matches: boolean }) => void) => {
          mediaQueryListeners = mediaQueryListeners.filter((l) => l !== listener);
        },
        dispatchEvent: () => false,
      }),
    });
  });

  describe('ThemeProvider & useTheme Hook', () => {
    it('initializes with default dark theme when no localStorage value exists', () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>,
      });

      expect(result.current.theme).toBe('dark');
      expect(result.current.resolvedTheme).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('initializes with default light theme when specified', () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider defaultTheme="light">{children}</ThemeProvider>,
      });

      expect(result.current.theme).toBe('light');
      expect(result.current.resolvedTheme).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('restores persisted theme preference from localStorage on mount', () => {
      localStorage.setItem('convey_theme_preference', 'light');

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>,
      });

      expect(result.current.theme).toBe('light');
      expect(result.current.resolvedTheme).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('switches explicitly to light theme and persists to localStorage', () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>,
      });

      act(() => {
        result.current.setTheme('light');
      });

      expect(result.current.theme).toBe('light');
      expect(result.current.resolvedTheme).toBe('light');
      expect(localStorage.getItem('convey_theme_preference')).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('switches explicitly to dark theme and persists to localStorage', () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider defaultTheme="light">{children}</ThemeProvider>,
      });

      act(() => {
        result.current.setTheme('dark');
      });

      expect(result.current.theme).toBe('dark');
      expect(result.current.resolvedTheme).toBe('dark');
      expect(localStorage.getItem('convey_theme_preference')).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('System Default Dynamic Preference Handling', () => {
    it('resolves to dark when theme is system and OS prefers dark mode', () => {
      currentMatchesDark = true;

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider defaultTheme="system">{children}</ThemeProvider>,
      });

      expect(result.current.theme).toBe('system');
      expect(result.current.resolvedTheme).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('resolves to light when theme is system and OS prefers light mode', () => {
      currentMatchesDark = false;

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider defaultTheme="system">{children}</ThemeProvider>,
      });

      expect(result.current.theme).toBe('system');
      expect(result.current.resolvedTheme).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('reacts live to OS prefers-color-scheme media query changes when theme is system', () => {
      currentMatchesDark = false;

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider defaultTheme="system">{children}</ThemeProvider>,
      });

      expect(result.current.resolvedTheme).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');

      // Simulate OS switching to dark mode
      act(() => {
        for (const listener of mediaQueryListeners) {
          listener({ matches: true });
        }
      });

      expect(result.current.resolvedTheme).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

      // Simulate OS switching back to light mode
      act(() => {
        for (const listener of mediaQueryListeners) {
          listener({ matches: false });
        }
      });

      expect(result.current.resolvedTheme).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('ignores OS prefers-color-scheme media query changes when an explicit theme is selected', () => {
      currentMatchesDark = false;

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>,
      });

      expect(result.current.theme).toBe('dark');
      expect(result.current.resolvedTheme).toBe('dark');

      // Trigger OS light event
      act(() => {
        for (const listener of mediaQueryListeners) {
          listener({ matches: false });
        }
      });

      // Still dark because explicit selection takes precedence
      expect(result.current.theme).toBe('dark');
      expect(result.current.resolvedTheme).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('ThemeSwitcher Interactive Component', () => {
    it('renders dropdown variant and displays options for Light, Dark, and System Default', () => {
      const { container } = renderWithProviders(<ThemeSwitcher variant="navbar" />);

      const button = container.querySelector('button');
      expect(button).toBeDefined();
      if (!button) return;

      fireEvent.click(button);

      expect(container.textContent).toContain('Dark');
      expect(container.textContent).toContain('Light');
      expect(container.textContent).toContain('System');
    });

    it('renders segmented variant and switches themes on click', () => {
      const { container } = renderWithProviders(<ThemeSwitcher variant="segmented" />);

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(3);

      // Click Light option (first button)
      fireEvent.click(buttons[0]);
      expect(localStorage.getItem('convey_theme_preference')).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');

      // Click Dark option (second button)
      fireEvent.click(buttons[1]);
      expect(localStorage.getItem('convey_theme_preference')).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

      // Click System option (third button)
      fireEvent.click(buttons[2]);
      expect(localStorage.getItem('convey_theme_preference')).toBe('system');
    });
  });

  describe('Navbar & Layout Integration', () => {
    it('renders ThemeSwitcher inside Navbar', () => {
      const { container } = renderWithProviders(<Navbar onOpenCommandPalette={() => {}} />);

      expect(container.querySelector('[aria-label="Theme"]')).toBeDefined();
    });

    it('renders theme-aware layout container with resolved theme classes', () => {
      const { container } = renderWithProviders(
        <div className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white">
          <Navbar onOpenCommandPalette={() => {}} />
          <div data-testid="child-content">Content</div>
        </div>,
        'light',
      );

      expect(container.querySelector('[data-testid="child-content"]')).toBeDefined();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });

  describe('Command Palette Theme Switching Integration', () => {
    it('provides theme switching commands in CommandPalette and executes them', () => {
      const { container } = renderWithProviders(<CommandPalette open={true} onOpenChange={() => {}} />);

      const input = container.querySelector('input');
      expect(input).toBeDefined();
      if (!input) return;

      // Filter by theme
      fireEvent.input(input, { target: { value: 'theme' } });

      expect(container.textContent).toContain('Light Theme');
      expect(container.textContent).toContain('Dark Theme');
      expect(container.textContent).toContain('System Default Theme');

      // Click Light Theme command
      const lightOption = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Light Theme'),
      );
      expect(lightOption).toBeDefined();
      if (lightOption) {
        fireEvent.click(lightOption);
        expect(localStorage.getItem('convey_theme_preference')).toBe('light');
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      }
    });
  });

  describe('All Mission Control Pages Render in Light Mode Without Errors', () => {
    it('renders OverviewPage in light mode', () => {
      const { container } = renderWithProviders(<OverviewPage />, 'light');
      expect(container.textContent).toContain('Planetary Telemetry & Ops Center');
    });

    it('renders MessagesPage in light mode', () => {
      const { container } = renderWithProviders(<MessagesPage />, 'light');
      expect(container.textContent).toContain('Universal Message Explorer & Distributed Tracing');
    });

    it('renders ProvidersPage in light mode', () => {
      const { container } = renderWithProviders(<ProvidersPage />, 'light');
      expect(container.textContent).toContain('Provider Matrix & Circuit Breaker Cockpit');
    });

    it('renders ProviderConfigPage in light mode', () => {
      const { container } = renderWithProviders(<ProviderConfigPage />, 'light');
      expect(container.textContent).toContain('Provider Registration & Configuration Studio');
    });

    it('renders DlqPage in light mode', () => {
      const { container } = renderWithProviders(<DlqPage />, 'light');
      expect(container.textContent).toContain('Dead-Letter Queue (DLQ) & Dry-Run Blast-Radius Simulator');
    });

    it('renders DeliverabilityPage in light mode', () => {
      const { container } = renderWithProviders(<DeliverabilityPage />, 'light');
      expect(container.textContent).toContain('Deliverability Autopilot & Suppression Guard');
    });

    it('renders PoliciesPage in light mode', () => {
      const { container } = renderWithProviders(<PoliciesPage />, 'light');
      expect(container.textContent).toContain('DRR Multi-Tenant Scheduler & Traffic Policy Studio');
    });

    it('renders ComposerPage in light mode', () => {
      const { container } = renderWithProviders(<ComposerPage />, 'light');
      expect(container.textContent).toContain('Omnichannel Composer & Live Sandbox');
    });

    it('renders WebhooksPage in light mode', () => {
      const { container } = renderWithProviders(<WebhooksPage />, 'light');
      expect(container.textContent).toContain('Webhook Subscriptions & Delivery Inspector');
    });

    it('renders ArchitecturePage in light mode', () => {
      const { container } = renderWithProviders(<ArchitecturePage />, 'light');
      expect(container.textContent).toContain('System Topology & Prometheus Telemetry');
    });

    it('renders AuditPage in light mode', () => {
      const { container } = renderWithProviders(<AuditPage />, 'light');
      expect(container.textContent).toContain('Security & Compliance Audit Ledger');
    });
  });
});
