import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} = require('@tanstack/react-query');
const root = fileURLToPath(
  new URL('../src/features/applications/', import.meta.url),
);
let auth = { data: { user: { id: 2 } } };
function load(file) {
  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2017,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  const localRequire = (name) => {
    if (name === '@/features/auth/queries')
      return { useMeQuery: () => auth, authMeKey: ['auth', 'me'] };
    if (name.startsWith('.')) {
      const base = path.resolve(path.dirname(file), name);
      try {
        readFileSync(base + '.ts');
        return load(base + '.ts');
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
      return load(base + '.tsx');
    }
    return require(name);
  };
  vm.runInThisContext('(function(require,module,exports){' + compiled + '\n})')(
    localRequire,
    mod,
    mod.exports,
  );
  return mod.exports;
}
const api = load(path.join(root, 'api.ts'));

test('private API requests bind expected identity without sending applicantId in body', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(new Headers(options.headers).get('X-Expected-User-Id'), '2');
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    return Response.json({ application: null });
  });
  await api.getMyApplication('42', undefined, 2);
  await api.createApplication('42', { message: '참여해요' }, 2);
  await api.cancelMyApplication('42', 2);
});

for (const [action, code, status] of [
  ['create', 'APPLICATION_ALREADY_EXISTS', 409],
  ['cancel', 'APPLICATION_NOT_FOUND', 404],
  ['cancel', 'APPLICATION_INVALID_STATUS', 409],
  ['create', 'RECRUITMENT_CLOSED', 409],
  ['cancel', 'AUTH_SESSION_CHANGED', 409],
]) {
  test(`mutation reconciles active cache after ${code}`, async (t) => {
    const queryKey = ['recruitments', '42', 'my-application', 2];
    const next = {
      application:
        code === 'APPLICATION_NOT_FOUND' ? null : { id: 3, status: 'APPROVED' },
    };
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(queryKey, {
      application: { id: 3, status: 'PENDING' },
    });
    client.setQueryData(['auth', 'me'], { user: { id: 2 } });
    client.setQueryData(['recruitments', '42'], { status: 'OPEN' });
    const observer = new QueryObserver(client, {
      queryKey,
      queryFn: () => api.getMyApplication('42', undefined, 2),
    });
    const unsubscribe = observer.subscribe(() => {});
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      if (!options.method) return Response.json(next);
      return Response.json(
        { code, message: '서버 상태가 변경되었습니다.' },
        { status },
      );
    });
    const hooks = load(path.join(root, 'queries.ts'));
    let mutation;
    function Probe() {
      mutation =
        action === 'create'
          ? hooks.useCreateApplicationMutation('42', 2)
          : hooks.useCancelApplicationMutation('42', 2);
      return null;
    }
    renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(Probe),
      ),
    );
    try {
      await assert.rejects(
        mutation.mutateAsync({ message: '참여해요' }),
        /서버 상태/,
      );
      if (code === 'AUTH_SESSION_CHANGED') {
        assert.equal(client.getQueryState(['auth', 'me']).isInvalidated, true);
      } else {
        assert.deepEqual(client.getQueryData(queryKey), next);
      }
      if (code === 'RECRUITMENT_CLOSED')
        assert.equal(
          client.getQueryState(['recruitments', '42']).isInvalidated,
          true,
        );
    } finally {
      unsubscribe();
      client.clear();
    }
  });
}
test('application message validates trimmed 2-200 characters', () => {
  const { applicationSchema } = load(path.join(root, 'schema.ts'));
  assert.ok(applicationSchema);
  for (const message of ['', ' ', '가', '가'.repeat(201)])
    assert.equal(applicationSchema.safeParse({ message }).success, false);
  for (const message of ['가나', '가'.repeat(200)])
    assert.equal(applicationSchema.safeParse({ message }).success, true);
  assert.equal(
    applicationSchema.parse({ message: '  함께해요  ' }).message,
    '함께해요',
  );
});
test('POST sends only message, GET is private and cancellable, DELETE handles 204', async (t) => {
  assert.equal(typeof api.createApplication, 'function');
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (options.method === 'POST') {
      assert.equal(url, '/api/recruitments/42/applications');
      assert.deepEqual(JSON.parse(options.body), { message: '참여해요' });
      return Response.json(
        { application: { id: 1, status: 'PENDING' } },
        { status: 201 },
      );
    }
    if (options.method === 'DELETE') {
      assert.equal(url, '/api/recruitments/42/applications/me');
      return new Response(null, { status: 204 });
    }
    assert.equal(url, '/api/recruitments/42/my-application');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.signal, controller.signal);
    return Response.json({ application: null });
  });
  assert.equal(
    (
      await api.createApplication('42', {
        message: '참여해요',
        applicantId: 999,
        status: 'APPROVED',
      })
    ).application.status,
    'PENDING',
  );
  assert.deepEqual(await api.getMyApplication('42', controller.signal), {
    application: null,
  });
  assert.equal(await api.cancelMyApplication('42'), undefined);
});
test('API preserves business error messages and handles non-JSON upstream failures', async (t) => {
  assert.equal(typeof api.createApplication, 'function');
  let response = Response.json(
    {
      code: 'APPLICATION_ALREADY_EXISTS',
      message: '이미 지원한 모집글입니다.',
    },
    { status: 409 },
  );
  t.mock.method(globalThis, 'fetch', async () => response);
  await assert.rejects(
    api.createApplication('42', { message: '지원해요' }),
    /이미 지원/,
  );
  response = new Response('<html>proxy down</html>', { status: 502 });
  await assert.rejects(
    api.getMyApplication('42'),
    (e) => !e.message.includes('html') && e.message.includes('지원'),
  );
  response = Response.json({}, { status: 401 });
  await assert.rejects(api.cancelMyApplication('42'), /로그인/);
});
test('query keys isolate private application state between users and normalize route id', () => {
  const { myApplicationKey } = load(path.join(root, 'queries.ts'));
  assert.equal(typeof myApplicationKey, 'function');
  assert.deepEqual(myApplicationKey(42, 2), [
    'recruitments',
    '42',
    'my-application',
    2,
  ]);
  assert.notDeepEqual(myApplicationKey('42', 2), myApplicationKey('42', 3));
});
for (const scenario of [
  'logged-out',
  'owner',
  'open',
  'closed',
  'pending',
  'approved',
  'rejected',
  'lookup-error',
  'auth-error',
]) {
  test('application section renders correct state: ' + scenario, async () => {
    const { ApplicationSection } = load(
      path.join(root, 'application-section.tsx'),
    );
    assert.equal(typeof ApplicationSection, 'function');
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    auth =
      scenario === 'logged-out'
        ? { data: null }
        : scenario === 'owner'
          ? { data: { user: { id: 1 } } }
          : scenario === 'auth-error'
            ? { isError: true, error: new Error('확인 실패') }
            : { data: { user: { id: 2 } } };
    const queryKey = ['recruitments', '42', 'my-application', 2];
    client.setQueryData(queryKey, {
      application: ['pending', 'approved', 'rejected'].includes(scenario)
        ? {
            id: 3,
            message: '참여합니다',
            status: scenario.toUpperCase(),
            createdAt: '2026-09-20',
          }
        : null,
    });
    if (scenario === 'lookup-error')
      await assert.rejects(
        client.fetchQuery({
          queryKey,
          queryFn: async () => {
            throw new Error('지원 조회 실패');
          },
        }),
      );
    const html = renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(ApplicationSection, {
          recruitmentId: '42',
          authorId: 1,
          status: scenario === 'closed' ? 'CLOSED' : 'OPEN',
        }),
      ),
    );
    assert.equal(/<form/.test(html), scenario === 'open');
    assert.equal(html.includes('지원 취소'), scenario === 'pending');
    if (scenario === 'logged-out') assert.match(html, /href="\/login"/);
    if (scenario === 'closed') assert.match(html, /마감/);
    if (scenario === 'approved') assert.match(html, /APPROVED/);
    if (scenario === 'rejected') assert.match(html, /REJECTED/);
    if (scenario.endsWith('error')) assert.match(html, /role="alert"/);
    client.clear();
  });
}
