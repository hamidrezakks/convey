import './setup';
import { describe, expect, it } from 'bun:test';
import type { TraceSpan } from '@convey/shared';
import { render } from '@testing-library/react';
import { TraceWaterfall } from '../src/components/trace/TraceWaterfall';

describe('W3C Distributed Trace Waterfall Component Test Suite', () => {
  const mockSpans: TraceSpan[] = [
    {
      id: 'sp_1',
      name: 'http.ingest_acceptance',
      serviceName: 'convey-api',
      startTimeMs: 0,
      durationMs: 5.4,
      status: 'OK',
      attributes: { 'http.method': 'POST' },
    },
    {
      id: 'sp_2',
      name: 'outbox.db_transaction',
      serviceName: 'postgres',
      startTimeMs: 5.4,
      durationMs: 4.1,
      status: 'OK',
    },
    {
      id: 'sp_3',
      name: 'provider.aws-ses.wire_send',
      serviceName: 'provider-send-worker',
      startTimeMs: 9.5,
      durationMs: 64.2,
      status: 'OK',
    },
  ];

  it('renders all spans and computes total duration', () => {
    const { container } = render(
      <TraceWaterfall traceparent="00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" spans={mockSpans} />,
    );

    expect(container.textContent).toContain('W3C Distributed Trace');
    expect(container.textContent).toContain('3 Spans');
    expect(container.textContent).toContain('convey-api');
    expect(container.textContent).toContain('postgres');
    expect(container.textContent).toContain('provider-send-worker');
    expect(container.textContent).toContain('73.7ms'); // 9.5 + 64.2 = 73.7ms
  });

  it('displays traceparent header with copy button', () => {
    const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const { container } = render(<TraceWaterfall traceparent={traceparent} spans={mockSpans} />);

    expect(container.textContent).toContain(traceparent);
    expect(container.querySelector('button[title="Copy traceparent header"]')).not.toBeNull();
  });
});
