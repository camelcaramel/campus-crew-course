import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import ts from 'typescript';

const realFetch = globalThis.fetch;
let server, baseUrl, getRecruitments;
const responseBody = {
  items: [],
  meta: { page: 2, limit: 2, total: 3, totalPages: 2 },
};
before(async () => {
  const compile = (source) =>
    'data:text/javascript;base64,' +
    Buffer.from(
      ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext },
      }).outputText,
    ).toString('base64');
  const client = await readFile(
    new URL('../src/lib/api-client.ts', import.meta.url),
    'utf8',
  );
  const api = await readFile(
    new URL('../src/features/recruitments/api.ts', import.meta.url),
    'utf8',
  );
  ({ getRecruitments } = await import(
    compile(api.replace('@/lib/api-client', compile(client)))
  ));
  server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const valid =
      url.pathname === '/api/recruitments' &&
      url.searchParams.get('q') === 'React & 한글' &&
      url.searchParams.get('category') === 'STUDY' &&
      url.searchParams.get('page') === '2' &&
      url.searchParams.get('limit') === '2';
    response.writeHead(valid ? 200 : 400, {
      'Content-Type': 'application/json',
    });
    response.end(JSON.stringify(responseBody));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = 'http://127.0.0.1:' + server.address().port;
  globalThis.fetch = (url, options) => realFetch(baseUrl + url, options);
});
after(async () => {
  globalThis.fetch = realFetch;
  await new Promise((resolve) => server.close(resolve));
});
test('검색 조건을 안전하게 인코딩해 API에 보내고 items/meta 응답을 유지한다', async () => {
  assert.deepEqual(
    await getRecruitments({
      q: 'React & 한글',
      category: 'STUDY',
      page: 2,
      limit: 2,
    }),
    responseBody,
  );
});
