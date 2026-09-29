import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import ts from 'typescript';

let createRecruitment, server, baseUrl;
const realFetch = globalThis.fetch;
const input = {
  title: 'React 스터디',
  category: 'STUDY',
  content: '매주 함께 React를 공부할 팀원을 모집합니다.',
};
const result = {
  ...input,
  id: 42,
  authorId: 1,
  author: { id: 1, name: 'teacher' },
  status: 'OPEN',
  createdAt: '2026-09-19T00:00:00.000Z',
  updatedAt: '2026-09-19T00:00:00.000Z',
};

before(async () => {
  const clientSource = await readFile(
    new URL('../src/lib/api-client.ts', import.meta.url),
    'utf8',
  );
  const apiSource = await readFile(
    new URL('../src/features/recruitments/api.ts', import.meta.url),
    'utf8',
  );
  const compile = (source) => {
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2017,
      },
    });
    return (
      'data:text/javascript;base64,' +
      Buffer.from(outputText).toString('base64')
    );
  };
  ({ createRecruitment } = await import(
    compile(apiSource.replace('@/lib/api-client', compile(clientSource)))
  ));
  server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    const payload = JSON.parse(body);
    if (payload.title === 'network-error') {
      request.socket.destroy();
      return;
    }
    if (payload.title === 'http-error') {
      response.writeHead(500, { 'Content-Type': 'text/html' });
      response.end('<h1>Unavailable</h1>');
      return;
    }
    if (['401', '403'].includes(payload.title)) {
      response.writeHead(Number(payload.title));
      response.end('{}');
      return;
    }
    if (payload.title === 'validation-error') {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(
        '{"statusCode":400,"code":"VALIDATION_ERROR","message":"입력값을 확인해주세요."}',
      );
      return;
    }
    if (payload.title === 'invalid-json') {
      response.writeHead(201);
      response.end('invalid JSON');
      return;
    }
    const valid =
      request.method === 'POST' &&
      request.url === '/api/recruitments' &&
      request.headers['content-type'] === 'application/json' &&
      payload.title === 'React 스터디' &&
      payload.category === 'STUDY' &&
      payload.content === '매주 함께 React를 공부할 팀원을 모집합니다.' &&
      JSON.stringify(Object.keys(payload).sort()) ===
        JSON.stringify(['category', 'content', 'title']);
    response.writeHead(valid ? 201 : 400, {
      'Content-Type': 'application/json',
    });
    response.end(
      JSON.stringify(valid ? result : { message: 'Invalid request' }),
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = 'http://127.0.0.1:' + server.address().port;
  // Node has no browser origin; only resolve relative URLs, preserving real HTTP.
  globalThis.fetch = (path, init) => realFetch(new URL(path, baseUrl), init);
});

after(async () => {
  globalThis.fetch = realFetch;
  if (server) await new Promise((resolve) => server.close(resolve));
});

test('form values become a JSON POST without a client author and return the server row', async () => {
  assert.equal(typeof createRecruitment, 'function', 'Create API must exist');
  assert.deepEqual(
    await createRecruitment({ ...input, authorId: 999 }),
    result,
  );
  assert.equal(
    Object.hasOwn(input, 'authorId'),
    false,
    'Form input must not be mutated',
  );
});

for (const title of ['http-error', 'network-error']) {
  test(title + ' rejects with a user-facing create error', async () => {
    assert.equal(typeof createRecruitment, 'function', 'Create API must exist');
    await assert.rejects(createRecruitment({ ...input, title }), {
      message: '모집글을 등록하지 못했습니다. 잠시 후 다시 시도해주세요.',
    });
  });
}

test('create preserves server validation message for the form', async () => {
  await assert.rejects(
    createRecruitment({ ...input, title: 'validation-error' }),
    {
      message: '입력값을 확인해주세요.',
    },
  );
});

test('malformed success JSON rejects instead of pretending creation succeeded', async () => {
  assert.equal(typeof createRecruitment, 'function', 'Create API must exist');
  await assert.rejects(
    createRecruitment({ ...input, title: 'invalid-json' }),
    Error,
  );
});

for (const [status, message] of [
  [401, '로그인이 필요합니다. 다시 로그인해주세요.'],
  [403, '작성자만 수정하거나 삭제할 수 있습니다.'],
]) {
  test('create preserves authorization error ' + status, async () => {
    await assert.rejects(
      createRecruitment({ ...input, title: String(status) }),
      { message },
    );
  });
}
