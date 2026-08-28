import { SEEDED_API_KEY_RAW, seedDatabaseWithRealisticData } from '../apps/server/tests/helpers/db-seeder';

const E2E_PORT = 3999;
const BASE_URL = `http://127.0.0.1:${E2E_PORT}`;

async function runCommand(command: string[], cwd: string, envOverrides: Record<string, string> = {}): Promise<boolean> {
  console.log(`\n▶️ Executing: ${command.join(' ')} (in ${cwd})`);
  const proc = Bun.spawn(command, {
    cwd,
    env: {
      ...process.env,
      CONVEY_BASE_URL: BASE_URL,
      CONVEY_API_KEY: SEEDED_API_KEY_RAW,
      ...envOverrides,
    },
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const exitCode = await proc.exited;
  return exitCode === 0;
}

async function waitForServer(url: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${url}/health/liveness`);
      if (res.ok) {
        return true;
      }
    } catch {
      // ignore retry
    }
    await Bun.sleep(200);
  }
  return false;
}

async function main() {
  console.log('================================================================================');
  console.log('            CONVEY MULTI-SDK LIVE END-TO-END VERIFICATION SUITE                 ');
  console.log('================================================================================\n');

  // 1. Seed Database
  console.log('🌱 Seeding PostgreSQL 18 & DragonflyDB test state...');
  await seedDatabaseWithRealisticData();
  console.log('✅ Database state initialized successfully.');

  // 2. Start Live Server Process
  console.log(`🚀 Starting Convey HTTP Server on ${BASE_URL}...`);
  const serverProc = Bun.spawn(['bun', 'apps/server/src/index.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(E2E_PORT),
      NODE_ENV: 'development',
      CONVEY_REQUIRE_AUTH: 'true',
    },
    stdout: 'ignore',
    stderr: 'inherit',
  });

  const isReady = await waitForServer(BASE_URL);
  if (!isReady) {
    serverProc.kill();
    console.error('❌ Convey server failed to respond on /health/liveness within timeout.');
    process.exit(1);
  }
  console.log(`✅ Live server ready and accepting requests on ${BASE_URL}`);

  const results: { sdk: string; success: boolean }[] = [];

  try {
    // 3. Run TypeScript SDK E2E
    console.log('\n--------------------------------------------------------------------------------');
    console.log('🧪 1. Testing Official TypeScript SDK (@convey/sdk)');
    console.log('--------------------------------------------------------------------------------');
    const tsSuccess = await runCommand(['bun', 'test', 'packages/sdk/tests/e2e-live.test.ts'], process.cwd());
    results.push({ sdk: 'TypeScript (@convey/sdk)', success: tsSuccess });

    // 4. Run Go SDK E2E
    console.log('\n--------------------------------------------------------------------------------');
    console.log('🧪 2. Testing Official Go SDK (packages/sdk-go)');
    console.log('--------------------------------------------------------------------------------');
    const goSuccess = await runCommand(['go', 'test', '-v', '-race', './...'], `${process.cwd()}/packages/sdk-go`);
    results.push({ sdk: 'Go (packages/sdk-go)', success: goSuccess });

    // 5. Run Python SDK E2E
    console.log('\n--------------------------------------------------------------------------------');
    console.log('🧪 3. Testing Official Python SDK (convey-sdk)');
    console.log('--------------------------------------------------------------------------------');
    const pySuccess = await runCommand(
      ['python3', '-m', 'unittest', 'discover', '-s', 'packages/sdk-py/tests', '-v'],
      process.cwd(),
      { PYTHONPATH: `${process.cwd()}/packages/sdk-py` },
    );
    results.push({ sdk: 'Python (convey-sdk)', success: pySuccess });
  } finally {
    // 6. Graceful Server Shutdown
    console.log('\n🛑 Shutting down live test server process...');
    serverProc.kill();
    console.log('✅ Live test server stopped.');
  }

  // 7. Output Scorecard
  console.log('\n================================================================================');
  console.log('                        LIVE E2E TEST SCORECARD                                 ');
  console.log('================================================================================');
  let allPassed = true;
  for (const r of results) {
    const statusIcon = r.success ? '✅ PASSED' : '❌ FAILED';
    if (!r.success) allPassed = false;
    console.log(`  ${r.sdk.padEnd(35)} : ${statusIcon}`);
  }
  console.log('================================================================================\n');

  if (!allPassed) {
    console.error('❌ Some SDK E2E tests failed.');
    process.exit(1);
  }

  console.log('🎉 ALL SDK E2E LIVE TESTS PASSED CLEANLY WITH ZERO ERRORS!\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal E2E orchestrator error:', err);
  process.exit(1);
});
