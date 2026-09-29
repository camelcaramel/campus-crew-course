import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(
  new URL('../next.config.ts', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

async function destination(env) {
  const exports = {};
  vm.runInNewContext(compiled, { exports, process: { env }, URL });
  return (await exports.default.rewrites())[0].destination;
}

test('API_BASE_URL overrides legacy API_ORIGIN and keeps the API path', async () => {
  assert.equal(
    await destination({
      API_BASE_URL: 'https://campus-crew-api.onrender.com/',
      API_ORIGIN: 'http://localhost:4022',
    }),
    'https://campus-crew-api.onrender.com/api/:path*',
  );
});

test('local default and historical API_ORIGIN remain compatible', async () => {
  assert.equal(await destination({}), 'http://localhost:4000/api/:path*');
  assert.equal(
    await destination({ API_ORIGIN: 'http://127.0.0.1:4022' }),
    'http://127.0.0.1:4022/api/:path*',
  );
});

test('Vercel requires API_BASE_URL rather than silently deploying localhost', async () => {
  await assert.rejects(destination({ VERCEL: '1' }), /API_BASE_URL/);
  await assert.rejects(
    destination({ VERCEL: '1', API_ORIGIN: 'http://localhost:4000' }),
    /API_BASE_URL/,
  );
});

test('production without VERCEL refuses a missing API_BASE_URL before deployment', async () => {
  await assert.rejects(destination({ NODE_ENV: 'production' }), /API_BASE_URL/);
});

test('production cannot hide missing API_BASE_URL behind legacy API_ORIGIN', async () => {
  await assert.rejects(
    destination({
      NODE_ENV: 'production',
      API_ORIGIN: 'http://localhost:4000',
    }),
    /API_BASE_URL/,
  );
});

test('an explicit backend supports local production smoke without VERCEL', async () => {
  assert.equal(
    await destination({
      NODE_ENV: 'production',
      API_BASE_URL: 'http://127.0.0.1:4000',
    }),
    'http://127.0.0.1:4000/api/:path*',
  );
});

for (const origin of [
  'http://campus-crew-api.onrender.com',
  'https://localhost:4000',
  'https://127.0.0.1:4000',
  'https://[::1]:4000',
]) {
  test(`Vercel refuses non-public HTTPS backend: ${origin}`, async () => {
    await assert.rejects(
      destination({ VERCEL: '1', API_BASE_URL: origin }),
      /API_BASE_URL/,
    );
  });
}

test('valid Vercel origin produces a same-origin external rewrite', async () => {
  assert.equal(
    await destination({
      VERCEL: '1',
      API_BASE_URL: 'https://campus-crew-api.onrender.com',
    }),
    'https://campus-crew-api.onrender.com/api/:path*',
  );
});

test('malformed or credential-bearing URLs fail without exposing their values', async () => {
  for (const url of [
    'not-a-url',
    'https://user:do-not-print@example.com',
    'https://example.com/api',
    'https://example.com?token=do-not-print',
    'https://example.com#fragment',
  ]) {
    await assert.rejects(destination({ API_BASE_URL: url }), (error) => {
      assert.match(error.message, /API_BASE_URL/);
      assert.ok(!error.message.includes('do-not-print'));
      return true;
    });
  }
});
