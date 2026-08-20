import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createApiBenchmarkSuite } from '../../bench/api-benchmarks';
import { BenchmarkSuite } from '../../bench/bench-harness';
import { createEngineBenchmarkSuite } from '../../bench/engine-benchmarks';
import { createPipelineBenchmarkSuite } from '../../bench/pipeline-e2e-benchmarks';
import { createStressBenchmarkSuite } from '../../bench/stress-benchmarks';
import { closeAllProviderQueues } from '../../src/queues/provider-queues';
import { messageDispatchWorker } from '../../src/queues/workers/message-dispatch.worker';
import { disableProviderMock, enableProviderMock } from '../mocks/provider-mock';

describe('Convey Benchmark Automated Performance & SLA Verification Test Suite', () => {
  beforeAll(() => {
    enableProviderMock(0.0);
  });

  afterAll(async () => {
    disableProviderMock();
    await closeAllProviderQueues();
    try {
      await messageDispatchWorker.close();
    } catch {
      // Safe close
    }
  });

  it('Verifies Core Subsystem Micro-Engine Benchmark Throughput & Latency SLAs', async () => {
    const engineSuite = createEngineBenchmarkSuite();
    const results = await engineSuite.runAll();

    BenchmarkSuite.printResultsTable(results, 'CORE ENGINE BENCHMARK RESULTS');

    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.opsPerSec).toBeGreaterThan(50); // Minimum 50 ops/sec baseline for any engine
      expect(r.p95Ms).toBeLessThan(100); // p95 latency under 100ms
    }
  }, 30000);

  it('Verifies HTTP API Ingestion Benchmark Throughput & Acceptance SLAs', async () => {
    const apiSuite = await createApiBenchmarkSuite();
    const results = await apiSuite.runAll();

    BenchmarkSuite.printResultsTable(results, 'HTTP API INGESTION BENCHMARK RESULTS');

    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.opsPerSec).toBeGreaterThan(10); // API operations exceed throughput baseline
      expect(r.avgMs).toBeLessThan(200); // API average latency under 200ms
    }
  }, 60000);

  it('Verifies High-Concurrency Pipeline & Outbox Batch Relay SLAs', async () => {
    const pipelineSuite = await createPipelineBenchmarkSuite();
    const results = await pipelineSuite.runAll();

    BenchmarkSuite.printResultsTable(results, 'PIPELINE CONCURRENCY BENCHMARK RESULTS');

    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.iterations).toBeGreaterThan(0);
    }
  }, 60000);

  it('Verifies Planetary-Scale Stress & Concurrency Benchmarks', async () => {
    const stressSuite = await createStressBenchmarkSuite();
    const results = await stressSuite.runAll();

    BenchmarkSuite.printResultsTable(results, 'PLANETARY STRESS BENCHMARK RESULTS');

    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.opsPerSec).toBeGreaterThan(5);
    }
  }, 60000);
});
