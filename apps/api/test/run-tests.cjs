const { spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { loadTestEnv, e2eCredentials } = require('./test-env.cjs');

const apiRoot = resolve(__dirname, '..');
loadTestEnv();
if (process.argv.includes('--e2e')) e2eCredentials();
process.env.NODE_ENV = 'test';

function run(entry, args = []) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd: apiRoot,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const prismaCli = resolve(
  require.resolve('prisma/package.json'),
  '../build/index.js',
);
run(prismaCli, ['generate']);
if (process.argv.includes('--prepare')) {
  run(prismaCli, ['migrate', 'deploy']);
  run(require.resolve('ts-node/dist/bin.js'), [
    '--project',
    'tsconfig.prisma.json',
    'prisma/seed.ts',
  ]);
  if (process.argv.includes('--e2e')) {
    run(require.resolve('ts-node/dist/bin.js'), [
      '--project',
      'tsconfig.prisma.json',
      'prisma/seed-e2e.ts',
    ]);
  }
} else {
  run(require.resolve('@nestjs/cli/bin/nest.js'), ['build']);
  if (!process.argv.includes('--legacy')) {
    run(require.resolve('jest/bin/jest'), [
      '--config',
      'test/jest.config.cjs',
      '--runInBand',
    ]);
  }
  if (process.argv.includes('--all') || process.argv.includes('--legacy')) {
    const files = readdirSync(__dirname).filter((name) =>
      name.endsWith('.e2e.mjs'),
    );
    const result = spawnSync(
      process.execPath,
      [
        '--test',
        '--test-concurrency=1',
        ...files.map((name) => resolve(__dirname, name)),
      ],
      {
        cwd: apiRoot,
        env: process.env,
        stdio: 'inherit',
        windowsHide: true,
      },
    );
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
}
