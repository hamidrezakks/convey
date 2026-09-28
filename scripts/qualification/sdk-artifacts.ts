import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const directory = mkdtempSync(join(tmpdir(), 'convey-sdk-consumer-'));
async function run(args: string[], cwd = directory) {
  const child = Bun.spawn(args, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code) throw new Error(`${args.join(' ')} failed:\n${stderr}\n${stdout}`);
  return stdout;
}
try {
  await run(['bun', 'run', 'build:sdk'], root);
  const packed = JSON.parse(
    await run(
      ['npm', 'pack', '--json', '--ignore-scripts', '--pack-destination', directory],
      join(root, 'packages/sdk'),
    ),
  )[0];
  if (packed.files.some((file: { path: string }) => /(^|\/)\.env|private.*key|node_modules/.test(file.path)))
    throw new Error('Unexpected package contents');
  await Bun.write(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  await run([
    'npm',
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--offline',
    join(directory, packed.filename),
  ]);
  const smoke = `
import assert from 'node:assert/strict';
import { Convey, Channel } from '@convey/sdk';
let seen;
const client = new Convey({ apiKey: 'mock-only', teamId: 'mock-team', baseUrl:'http://localhost:3000', fetch: async (url, init) => {
  seen = {url:String(url),body:JSON.parse(init.body),headers:new Headers(init.headers)};
  return Response.json({success:true,messageId:'msg_01J00000000000000000000000',state:'accepted'}, {status:202});
}});
const sent = await client.messages.send({channel:Channel.SMS,recipient:'+15005550009',content:{text:'Mock artifact consumer'}});
assert.equal(sent.publicId,'msg_01J00000000000000000000000');
assert.equal(seen.body.recipients.phone,'+15005550009');
assert.equal(seen.body.team,'mock-team');
assert.equal(seen.body.channels[0].content.text,'Mock artifact consumer');
assert.ok(seen.headers.get('authorization')?.includes('mock-only') || seen.headers.get('x-api-key') === 'mock-only');
`;
  await Bun.write(join(directory, 'consumer.mjs'), smoke);
  await Bun.write(
    join(directory, 'consumer.cjs'),
    `const assert = require('node:assert/strict'); const { Convey } = require('@convey/sdk'); assert.equal(typeof new Convey({apiKey:'mock-only',baseUrl:'http://localhost:3000'}).messages.send, 'function');`,
  );
  await run(['node', 'consumer.mjs']);
  await run(['node', 'consumer.cjs']);
  await run(['bun', 'consumer.mjs']);
  await Bun.write(
    join(directory, 'consumer.mts'),
    `import { Convey, Channel } from '@convey/sdk'; const c = new Convey({apiKey:'mock'}); void c.messages.send({channel:Channel.SMS,recipient:'+15005550009',content:{text:'Mock'}});`,
  );
  await Bun.write(
    join(directory, 'consumer.cts'),
    `import { Convey } from '@convey/sdk'; const c = new Convey({apiKey:'mock'}); void c.messages;`,
  );
  await run([
    'bun',
    join(root, 'node_modules/.bin/tsc'),
    '--noEmit',
    '--strict',
    '--module',
    'NodeNext',
    '--moduleResolution',
    'NodeNext',
    '--target',
    'ES2022',
    '--skipLibCheck',
    'false',
    'consumer.mts',
    'consumer.cts',
  ]);
  mkdirSync(join(directory, 'go-consumer'));
  await Bun.write(
    join(directory, 'go-consumer/go.mod'),
    `module mockconsumer\n\ngo 1.22\n\nrequire github.com/hamidrezakks/convey/packages/sdk-go v0.0.0\nreplace github.com/hamidrezakks/convey/packages/sdk-go => ${join(root, 'packages/sdk-go')}\n`,
  );
  await Bun.write(
    join(directory, 'go-consumer/main.go'),
    `package main\nimport _ "github.com/hamidrezakks/convey/packages/sdk-go"\nfunc main() {}\n`,
  );
  await run(['go', 'build', '-o', join(directory, 'mock-go-consumer'), '.'], join(directory, 'go-consumer'));
  console.log(
    JSON.stringify(
      {
        mode: 'mock-only',
        npm: { filename: packed.filename, integrity: packed.integrity },
        checks: [
          'Node ESM request serialization',
          'Node CommonJS import',
          'Bun ESM request serialization',
          'TypeScript NodeNext ESM/CommonJS types',
          'external Go consumer compilation',
        ],
        limitations:
          'Go uses a local module replacement, not a published tag. Python wheel verification runs separately.',
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
