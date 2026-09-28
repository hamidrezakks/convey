import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sdkRoot = resolve(__dirname, '..');
const distDir = resolve(sdkRoot, 'dist');

async function buildSdk() {
  console.log('⚡ Building @convey/sdk production bundle...');

  // 1. Clean dist directory
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
  mkdirSync(distDir, { recursive: true });

  // 2. Build ESM bundle
  console.log('📦 Generating ESM bundle (dist/index.js)...');
  const esmBuild = await Bun.build({
    entrypoints: [resolve(sdkRoot, 'src/index.ts')],
    outdir: distDir,
    format: 'esm',
    target: 'node',
    sourcemap: 'external',
    naming: {
      entry: '[name].js',
    },
  });

  if (!esmBuild.success) {
    console.error('❌ ESM build failed:');
    for (const log of esmBuild.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  // 3. Build CommonJS bundle
  console.log('📦 Generating CJS bundle (dist/index.cjs)...');
  const cjsBuild = await Bun.build({
    entrypoints: [resolve(sdkRoot, 'src/index.ts')],
    outdir: distDir,
    format: 'cjs',
    target: 'node',
    sourcemap: 'external',
    naming: {
      entry: '[name].cjs',
    },
  });

  if (!cjsBuild.success) {
    console.error('❌ CJS build failed:');
    for (const log of cjsBuild.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  // 4. Generate TypeScript Declaration Files
  console.log('📝 Generating TypeScript declarations (dist/index.d.ts & dist/index.d.cts)...');
  const tscProc = Bun.spawnSync(['bunx', 'tsc', '-p', resolve(sdkRoot, 'tsconfig.build.json')], {
    cwd: sdkRoot,
    stdout: 'inherit',
    stderr: 'inherit',
  });

  if (tscProc.exitCode !== 0) {
    console.error('❌ TypeScript declaration generation failed');
    process.exit(tscProc.exitCode);
  }

  // NodeNext requires explicit extensions and a separate CommonJS declaration graph.
  // Rewriting only index.d.cts leaves its re-exports pointing at ESM declarations.
  for (const file of new Bun.Glob('**/*.d.ts').scanSync(distDir)) {
    const path = resolve(distDir, file);
    const original = readFileSync(path, 'utf8').replace(/\n?\/\/# sourceMappingURL=.*$/gm, '');
    const declarations = (extension: string) =>
      original.replace(/(['"])(\.{1,2}\/[^'"]+)\1/g, (_match, quote: string, specifier: string) => {
        const target = existsSync(resolve(dirname(path), `${specifier}.d.ts`))
          ? specifier
          : existsSync(resolve(dirname(path), specifier, 'index.d.ts'))
            ? `${specifier}/index`
            : undefined;
        if (!target) throw new Error(`Unresolved declaration import ${specifier} in ${file}`);
        return `${quote}${target}.${extension}${quote}`;
      });
    writeFileSync(path, declarations('js'));
    writeFileSync(path.replace(/\.d\.ts$/, '.d.cts'), declarations('cjs'));
    rmSync(`${path}.map`, { force: true });
  }

  // 5. Verification & Summary
  const expectedFiles = ['index.js', 'index.js.map', 'index.cjs', 'index.cjs.map', 'index.d.ts', 'index.d.cts'];

  console.log('\n✅ Verification of generated artifacts:');
  for (const file of expectedFiles) {
    const filePath = resolve(distDir, file);
    if (!existsSync(filePath)) {
      console.error(`❌ Missing expected build output: ${file}`);
      process.exit(1);
    }
    const stat = Bun.file(filePath);
    const sizeKb = (stat.size / 1024).toFixed(2);
    console.log(`   - dist/${file.padEnd(16)} (${sizeKb} KB)`);
  }

  console.log('\n✨ @convey/sdk build completed successfully!\n');
}

buildSdk().catch((err) => {
  console.error('Fatal build error:', err);
  process.exit(1);
});
