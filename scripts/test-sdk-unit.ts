const files = Array.from(new Bun.Glob('packages/sdk/tests/**/*.test.ts').scanSync('.')).filter(
  (file) => !file.endsWith('/integration.test.ts') && !file.endsWith('/e2e-live.test.ts'),
);
const child = Bun.spawn(['bun', 'test', ...files.sort()], { stdout: 'inherit', stderr: 'inherit' });
process.exit(await child.exited);
