import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import ts from 'typescript';

let api, server;
const realFetch = globalThis.fetch;
const row = {
  id: 42,
  title: '수정한 제목',
  content: '기존 본문은 그대로 보존합니다.',
  category: 'STUDY',
  status: 'OPEN',
  authorId: 1,
  author: { id: 1, name: 'teacher' },
  createdAt: '2026-09-19T00:00:00.000Z',
  updatedAt: '2026-09-19T01:00:00.000Z',
};

before(async () => {
  const compile = (source) =>
    'data:text/javascript;base64,' +
    Buffer.from(
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2017,
        },
      }).outputText,
    ).toString('base64');
  const client = await readFile(
    new URL('../src/lib/api-client.ts', import.meta.url),
    'utf8',
  );
  const source = await readFile(
    new URL('../src/features/recruitments/api.ts', import.meta.url),
    'utf8',
  );
  api = await import(
    compile(source.replace('@/lib/api-client', compile(client)))
  );
  server = createServer(async (request, response) => {
    if (
      ['/api/recruitments/401', '/api/recruitments/403'].includes(request.url)
    ) {
      response.writeHead(Number(request.url.split('/').pop()));
      response.end('{}');
      return;
    }
    if (request.url === '/api/recruitments/503') {
      request.socket.destroy();
      return;
    }
    if (request.url === '/api/recruitments/404') {
      response.writeHead(404, { 'Content-Type': 'text/html' });
      response.end('<h1>Not found</h1>');
      return;
    }
    if (request.url === '/api/recruitments/500') {
      response.writeHead(200);
      response.end('bad JSON');
      return;
    }
    let body = '';
    for await (const chunk of request) body += chunk;
    if (
      request.method === 'DELETE' &&
      request.url === '/api/recruitments/42' &&
      body === ''
    ) {
      response.writeHead(204);
      response.end();
      return;
    }
    if (
      request.method === 'PATCH' &&
      request.url === '/api/recruitments/42' &&
      request.headers['content-type'] === 'application/json' &&
      body === JSON.stringify({ title: '수정한 제목' })
    ) {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(row));
      return;
    }
    response.writeHead(400);
    response.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  globalThis.fetch = (path, init) => realFetch(new URL(path, base), init);
});

after(async () => {
  globalThis.fetch = realFetch;
  if (server) await new Promise((resolve) => server.close(resolve));
});

test('PATCH sends only supplied fields and returns the updated server record', async () => {
  assert.equal(typeof api.updateRecruitment, 'function');
  const input = { title: '수정한 제목' };
  assert.deepEqual(await api.updateRecruitment(42, input), row);
  assert.deepEqual(input, { title: '수정한 제목' });
});

test('DELETE accepts an empty 204 response without JSON parsing', async () => {
  assert.equal(typeof api.deleteRecruitment, 'function');
  assert.equal(await api.deleteRecruitment(42), undefined);
});

for (const [name, message] of [
  ['updateRecruitment', '모집글을 수정하지 못했습니다.'],
  ['deleteRecruitment', '모집글을 삭제하지 못했습니다.'],
]) {
  for (const id of [404, 503]) {
    test(`${name} rejects HTTP/network failure ${id} with a user-facing error`, async () => {
      assert.equal(typeof api[name], 'function');
      await assert.rejects(api[name](id, { title: '수정한 제목' }), {
        message,
      });
    });
  }
}

test('PATCH rejects malformed success JSON', async () => {
  assert.equal(typeof api.updateRecruitment, 'function');
  await assert.rejects(
    api.updateRecruitment(500, { title: '수정한 제목' }),
    Error,
  );
});

for (const name of ['updateRecruitment', 'deleteRecruitment']) {
  for (const [status, message] of [
    [401, '로그인이 필요합니다. 다시 로그인해주세요.'],
    [403, '작성자만 수정하거나 삭제할 수 있습니다.'],
  ]) {
    test(name + ' preserves authorization error ' + status, async () => {
      await assert.rejects(api[name](status, { title: '수정' }), { message });
    });
  }
}
