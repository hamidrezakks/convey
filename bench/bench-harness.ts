export interface BenchmarkResult {
  name: string;
  category: string;
  iterations: number;
  totalTimeMs: number;
  opsPerSec: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  memoryDeltaMb: number;
}

export interface BenchmarkOptions {
  name: string;
  category?: string;
  warmupIterations?: number;
  iterations?: number;
  fn: () => Promise<void> | void;
}

export class BenchmarkSuite {
  private benchmarks: BenchmarkOptions[] = [];
  private suiteName: string;

  constructor(suiteName = 'Convey Benchmark Suite') {
    this.suiteName = suiteName;
  }

  add(name: string, fn: () => Promise<void> | void, options?: Partial<BenchmarkOptions>): this {
    this.benchmarks.push({
      name,
      category: options?.category || 'General',
      warmupIterations: options?.warmupIterations ?? 10,
      iterations: options?.iterations ?? 100,
      fn,
    });
    return this;
  }

  async runBenchmark(bm: BenchmarkOptions): Promise<BenchmarkResult> {
    // 1. Warmup phase
    const warmupCount = bm.warmupIterations ?? 10;
    for (let i = 0; i < warmupCount; i++) {
      await bm.fn();
    }

    // Force GC if available
    if (global.gc) {
      global.gc();
    }

    const startMemory = process.memoryUsage().heapUsed;
    const iterations = bm.iterations ?? 100;
    const latencies: number[] = new Array(iterations);

    const overallStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      await bm.fn();
      const t1 = performance.now();
      latencies[i] = t1 - t0;
    }
    const overallEnd = performance.now();
    const endMemory = process.memoryUsage().heapUsed;

    const totalTimeMs = overallEnd - overallStart;
    const opsPerSec = (iterations / totalTimeMs) * 1000;

    latencies.sort((a, b) => a - b);

    const minMs = latencies[0];
    const maxMs = latencies[latencies.length - 1];
    const sum = latencies.reduce((acc, val) => acc + val, 0);
    const avgMs = sum / iterations;

    const getPercentile = (p: number) => {
      const idx = Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length));
      return latencies[idx];
    };

    const p50Ms = getPercentile(50);
    const p90Ms = getPercentile(90);
    const p95Ms = getPercentile(95);
    const p99Ms = getPercentile(99);
    const memoryDeltaMb = Math.max(0, (endMemory - startMemory) / (1024 * 1024));

    return {
      name: bm.name,
      category: bm.category || 'General',
      iterations,
      totalTimeMs: Number(totalTimeMs.toFixed(2)),
      opsPerSec: Number(opsPerSec.toFixed(1)),
      minMs: Number(minMs.toFixed(3)),
      maxMs: Number(maxMs.toFixed(3)),
      avgMs: Number(avgMs.toFixed(3)),
      p50Ms: Number(p50Ms.toFixed(3)),
      p90Ms: Number(p90Ms.toFixed(3)),
      p95Ms: Number(p95Ms.toFixed(3)),
      p99Ms: Number(p99Ms.toFixed(3)),
      memoryDeltaMb: Number(memoryDeltaMb.toFixed(3)),
    };
  }

  async runAll(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    console.log(`\n🚀 Running [${this.suiteName}] (${this.benchmarks.length} benchmarks)...\n`);

    for (const bm of this.benchmarks) {
      process.stdout.write(`  ⏳ Running: ${bm.name}... `);
      const res = await this.runBenchmark(bm);
      results.push(res);
      console.log(`✅ ${res.opsPerSec.toLocaleString()} ops/sec (p95: ${res.p95Ms}ms)`);
    }

    return results;
  }

  static printResultsTable(results: BenchmarkResult[], title = 'CONVEY BENCHMARK REPORT'): void {
    console.log(
      '\n====================================================================================================',
    );
    console.log(`                               ${title}`);
    console.log('====================================================================================================');

    // Group by category
    const categories = Array.from(new Set(results.map((r) => r.category)));

    for (const cat of categories) {
      console.log(`\n📌 Category: ${cat}`);
      const catResults = results.filter((r) => r.category === cat);

      const tableData = catResults.map((r) => ({
        'Benchmark Name': r.name,
        'Ops/sec': `${r.opsPerSec.toLocaleString()}/s`,
        'Avg (ms)': `${r.avgMs}ms`,
        'p50 (ms)': `${r.p50Ms}ms`,
        'p95 (ms)': `${r.p95Ms}ms`,
        'p99 (ms)': `${r.p99Ms}ms`,
        'Min (ms)': `${r.minMs}ms`,
        'Max (ms)': `${r.maxMs}ms`,
        Iters: r.iterations,
      }));

      console.table(tableData);
    }
    console.log(
      '====================================================================================================\n',
    );
  }
}
