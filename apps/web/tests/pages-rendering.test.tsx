import './setup';
import { beforeEach, describe, expect, it } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type React from 'react';
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

function renderWithClient(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Super Senior QA: Comprehensive Mission Control Pages Render Suite', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('renders OverviewPage with planetary telemetry, metrics, and KPI cards without crashing', () => {
    const { container } = renderWithClient(<OverviewPage />);
    expect(container).toBeDefined();
    expect(container.textContent).toContain('Planetary Telemetry & Ops Center');
    expect(container.textContent).toContain('Real-Time Ingestion');
    expect(container.textContent).toContain('P95 Latency (SLA)');
    expect(container.textContent).toContain('24h Delivery Rate');
    expect(container.textContent).toContain('WhatsApp Cost Saved');
    expect(container.textContent).toContain('Queue Depths & Autoscaler');
    expect(container.textContent).toContain('Subsystem Resilience Matrix');
  });

  it('renders MessagesPage with search, channel select, status select, and data table', () => {
    const { container } = renderWithClient(<MessagesPage />);
    expect(container).toBeDefined();
    expect(container.textContent).toContain('Universal Message Explorer & Distributed Tracing');
    expect(container.textContent).toContain('All Channels');
    expect(container.textContent).toContain('All Statuses');
  });

  it('renders ProvidersPage with health matrix, circuit breakers, and canary trigger', () => {
    const { container } = renderWithClient(<ProvidersPage />);
    expect(container).toBeDefined();
    expect(container.textContent).toContain('Provider Matrix & Circuit Breaker Cockpit');
  });

  it('renders ProviderConfigPage with catalog selector and setup studio', () => {
    const { container } = renderWithClient(<ProviderConfigPage />);
    expect(container).toBeDefined();
    expect(container.textContent).toContain('Provider Registration & Configuration Studio');
  });

  it('renders DlqPage with surgical replay and blast radius controls', () => {
    const { container } = renderWithClient(<DlqPage />);
    expect(container).toBeDefined();
    expect(container.textContent).toContain('Dead-Letter Queue (DLQ) & Dry-Run Blast-Radius Simulator');
    expect(container.textContent).toContain('Simulate Dry-Run Replay');
  });

  it('renders DeliverabilityPage with suppression manager and autopilot meters', () => {
    const { container } = renderWithClient(<DeliverabilityPage />);
    expect(container).toBeDefined();
    expect(container.textContent).toContain('Deliverability Autopilot & Suppression Guard');
    expect(container.textContent).toContain('SPF Authentication');
  });

  it('renders PoliciesPage with DRR multi-tenant SLA engine', () => {
    const { container } = renderWithClient(<PoliciesPage />);
    expect(container).toBeDefined();
    expect(container.textContent).toContain('DRR Multi-Tenant Scheduler & Traffic Policy Studio');
    expect(container.textContent).toContain('Deficit Weighted Round Robin');
  });

  it('renders ComposerPage with omnichannel preview sandbox', () => {
    const { container } = renderWithClient(<ComposerPage />);
    expect(container).toBeDefined();
    expect(container.textContent).toContain('Omnichannel Composer & Live Sandbox');
    expect(container.textContent).toContain('Live Frame Preview');
  });

  it('renders WebhooksPage with webhook subscription inspector', () => {
    const { container } = renderWithClient(<WebhooksPage />);
    expect(container).toBeDefined();
    expect(container.textContent).toContain('Webhook Subscriptions & Delivery Inspector');
  });

  it('renders ArchitecturePage with topology map and Prometheus metrics', () => {
    const { container } = renderWithClient(<ArchitecturePage />);
    expect(container).toBeDefined();
    expect(container.textContent).toContain('System Topology & Prometheus Telemetry');
  });

  it('renders AuditPage with immutable compliance audit ledger', () => {
    const { container } = renderWithClient(<AuditPage />);
    expect(container).toBeDefined();
    expect(container.textContent).toContain('Security & Compliance Audit Ledger');
  });
});
