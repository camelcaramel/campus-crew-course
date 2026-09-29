import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import ts from 'typescript';

let getJson;
let baseUrl;
let server;

before(async () => {
  const source = await readFile(
    new URL('../src/lib/api-client.ts', import.meta.url),
    'utf8',
  ).catch(() => 'export const getJson = undefined;');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  });
  ({ getJson } = await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  ));
  server = createServer((request, response) => {
    if (request.url === '/ok') {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ id: 7, title: 'DB recruitment' }));
    } else if (request.url === '/missing') {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end('{"message":"Not found"}');
    } else if (request.url === '/invalid-json') {
      response.writeHead(200);
      response.end('invalid JSON');
    } else if (request.url === '/network-error') {
      request.socket.destroy();
    } else {
      response.writeHead(500, { 'Content-Type': 'text/html' });
      response.end('<h1>Proxy unavailable</h1>');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test('successful GET returns parsed server data', async () => {
  assert.equal(typeof getJson, 'function', 'Typed GET client must exist');
  assert.deepEqual(await getJson(`${baseUrl}/ok`), {
    id: 7,
    title: 'DB recruitment',
  });
});

test('404 preserves the server error message', async () => {
  assert.equal(typeof getJson, 'function', 'Typed GET client must exist');
  await assert.rejects(getJson(`${baseUrl}/missing`), {
    name: 'Error',
    message: 'Not found',
  });
});

test('non-JSON proxy errors reject before attempting JSON parsing', async () => {
  assert.equal(typeof getJson, 'function', 'Typed GET client must exist');
  await assert.rejects(getJson(`${baseUrl}/unavailable`), {
    name: 'Error',
    message: '모집글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
  });
});

test('network failures reject instead of returning empty data', async () => {
  assert.equal(typeof getJson, 'function', 'Typed GET client must exist');
  await assert.rejects(getJson(`${baseUrl}/network-error`), Error);
});

test('malformed successful JSON rejects instead of returning invalid data', async () => {
  assert.equal(typeof getJson, 'function', 'Typed GET client must exist');
  await assert.rejects(getJson(`${baseUrl}/invalid-json`), SyntaxError);
});
