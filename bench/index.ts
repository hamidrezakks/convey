import { closeAllProviderQueues } from '../src/queues/provider-queues';
import { messageDispatchWorker } from '../src/queues/workers/message-dispatch.worker';
import { disableProviderMock } from '../tests/mocks/provider-mock';
import { createApiBenchmarkSuite } from './api-benchmarks';
import { type BenchmarkResult, BenchmarkSuite } from './bench-harness';
import { createEngineBenchmarkSuite } from './engine-benchmarks';
import { createPipelineBenchmarkSuite } from './pipeline-e2e-benchmarks';

async function main() {
  const args = process.argv.slice(2);
  const runApi = args.includes('--api') || (!args.includes('--engine') && !args.includes('--pipeline'));
  const runEngine = args.includes('--engine') || (!args.includes('--api') && !args.includes('--pipeline'));
  const runPipeline = args.includes('--pipeline') || (!args.includes('--api') && !args.includes('--engine'));
  const outputJson = args.includes('--json');

  const allResults: BenchmarkResult[] = [];

  try {
    if (runEngine) {
      const engineSuite = createEngineBenchmarkSuite();
      const results = await engineSuite.runAll();
      allResults.push(...results);
    }

    if (runApi) {
      const apiSuite = await createApiBenchmarkSuite();
      const results = await apiSuite.runAll();
      allResults.push(...results);
    }

    if (runPipeline) {
      const pipelineSuite = await createPipelineBenchmarkSuite();
      const results = await pipelineSuite.runAll();
      allResults.push(...results);
    }

    if (outputJson) {
      console.log(JSON.stringify(allResults, null, 2));
    } else {
      BenchmarkSuite.printResultsTable(allResults, 'CONVEY PLATFORM BENCHMARK REPORT');
    }
  } catch (err) {
    console.error('Benchmark execution error:', err);
  } finally {
    disableProviderMock();
    await closeAllProviderQueues();
    try {
      await messageDispatchWorker.close();
    } catch {
      // Safe close
    }
    process.exit(0);
  }
}

if (import.meta.main) {
  main();
}
