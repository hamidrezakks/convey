const performanceOnly = process.argv.includes('--performance');
const files = Array.from(new Bun.Glob('apps/server/tests/**/*.test.ts').scanSync('.')).sort();
const performancePattern = /(?:bench|stress|load-10k|scenarios-500)/;
const selected = files.filter(
  (file) => !file.includes('/hardening/') && performancePattern.test(file) === performanceOnly,
);
if (!selected.length) throw new Error('No tests selected');
const processHandle = Bun.spawn(['bun', 'test', ...selected, '--timeout', '30000'], {
  stdout: 'inherit',
  stderr: 'inherit',
  env: process.env,
});
process.exit(await processHandle.exited);
