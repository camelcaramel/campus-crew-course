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
    if (name.startsWith('@/components/'))
      return load(path.resolve(root, '../../', name.slice(2)) + '.tsx');
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

const row = {
  id: 10,
  message: '함께 참여하고 싶습니다.',
  status: 'PENDING',
  createdAt: '2026-09-22T00:00:00.000Z',
  applicant: { id: 3, name: '김학생', email: 'student@example.com' },
};
test('owner API sends scoped paths, status-only JSON, expected user and no-store', async (t) => {
  assert.equal(typeof api.getApplications, 'function');
  assert.equal(typeof api.updateApplicationStatus, 'function');
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(new Headers(options.headers).get('X-Expected-User-Id'), '2');
    assert.equal(options.cache, 'no-store');
    if (options.method === 'PATCH') {
      assert.equal(url, '/api/recruitments/42/applications/10');
      assert.deepEqual(JSON.parse(options.body), { status: 'APPROVED' });
      return Response.json({ ...row, status: 'APPROVED' });
    }
    assert.equal(url, '/api/recruitments/42/applications');
    assert.equal(options.signal, controller.signal);
    return Response.json([row]);
  });
  assert.deepEqual(await api.getApplications(42, controller.signal, 2), [row]);
  assert.equal(
    (await api.updateApplicationStatus('42', 10, 'APPROVED', 2)).status,
    'APPROVED',
  );
});
for (const [status, code] of [
  [403, 'APPLICATION_FORBIDDEN'],
  [404, 'APPLICATION_NOT_FOUND'],
  [409, 'APPLICATION_INVALID_STATUS'],
]) {
  test(`owner API preserves ${status} ${code}`, async (t) => {
    assert.equal(typeof api.updateApplicationStatus, 'function');
    t.mock.method(globalThis, 'fetch', async () =>
      Response.json({ code, message: '처리할 수 없습니다.' }, { status }),
    );
    await assert.rejects(
      api.updateApplicationStatus(42, 10, 'REJECTED', 2),
      (e) => e.status === status && e.code === code,
    );
  });
}
for (const outcome of [
  'success',
  'conflict',
  'session',
  'unauthorized',
  'refetch-failure',
]) {
  test(`decision mutation reconciles ${outcome} without optimistic changes`, async (t) => {
    const hooks = load(path.join(root, 'queries.ts'));
    assert.equal(typeof hooks.useUpdateApplicationStatusMutation, 'function');
    assert.deepEqual(hooks.applicationsKey(42, 2), [
      'recruitments',
      '42',
      'applications',
      2,
    ]);
    assert.notDeepEqual(
      hooks.applicationsKey(42, 2),
      hooks.applicationsKey(42, 3),
    );
    const queryKey = ['recruitments', '42', 'applications', 2];
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    });
    client.setQueryData(queryKey, [row]);
    client.setQueryData(['auth', 'me'], { user: { id: 2 } });
    const observer = new QueryObserver(client, {
      queryKey,
      queryFn: () => api.getApplications('42', undefined, 2),
    });
    const unsubscribe = observer.subscribe(() => {});
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      if (!options.method) {
        if (outcome === 'refetch-failure')
          return Response.json({ message: '목록 조회 실패' }, { status: 500 });
        return Response.json([{ ...row, status: 'APPROVED' }]);
      }
      await gate;
      if (['success', 'refetch-failure'].includes(outcome))
        return Response.json({ ...row, status: 'APPROVED' });
      return Response.json(
        {
          code:
            outcome === 'conflict'
              ? 'APPLICATION_INVALID_STATUS'
              : 'AUTH_SESSION_CHANGED',
          message: '상태 변경',
        },
        { status: outcome === 'unauthorized' ? 401 : 409 },
      );
    });
    let mutation;
    function Probe() {
      mutation = hooks.useUpdateApplicationStatusMutation('42', 2);
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
      const action = mutation.mutateAsync({
        applicationId: 10,
        status: 'APPROVED',
      });
      assert.equal(client.getQueryData(queryKey)[0].status, 'PENDING');
      release();
      if (['success', 'refetch-failure'].includes(outcome)) await action;
      else await assert.rejects(action);
      if (['session', 'unauthorized'].includes(outcome))
        assert.equal(client.getQueryState(['auth', 'me']).isInvalidated, true);
      else if (outcome === 'refetch-failure') {
        assert.equal(client.getQueryState(queryKey).status, 'error');
        assert.equal(client.getQueryData(queryKey)[0].status, 'PENDING');
      } else assert.equal(client.getQueryData(queryKey)[0].status, 'APPROVED');
    } finally {
      unsubscribe();
      client.clear();
    }
  });
}
function renderManager(data) {
  const { ApplicationManager } = load(
    path.join(root, 'application-manager.tsx'),
  );
  assert.equal(typeof ApplicationManager, 'function');
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  if (data !== undefined)
    client.setQueryData(['recruitments', '42', 'applications', 2], data);
  try {
    return renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(ApplicationManager, {
          recruitmentId: '42',
          userId: 2,
        }),
      ),
    );
  } finally {
    client.clear();
  }
}
test('manager renders loading and empty states', () => {
  assert.match(renderManager(undefined), /불러오고/);
  assert.match(renderManager([]), /아직 지원자가 없습니다/);
});
test('manager renders applicant information and pending decision buttons', () => {
  const html = renderManager([row]);
  for (const text of [
    '김학생',
    'student@example.com',
    '함께 참여하고 싶습니다.',
    'PENDING',
    '2026-09-22',
  ])
    assert.ok(html.includes(text));
  assert.equal((html.match(/<button/g) || []).length, 2);
  assert.match(html, />승인<\/button>/);
  assert.match(html, />거절<\/button>/);
});
for (const status of ['APPROVED', 'REJECTED']) {
  test(`manager shows ${status} without decision buttons`, () => {
    const html = renderManager([{ ...row, status }]);
    assert.ok(html.includes(status));
    assert.equal((html.match(/<button/g) || []).length, 0);
  });
}

test('manager hides stale applicant data on list failure and offers retry', () => {
  const { ApplicationManager } = load(
    path.join(root, 'application-manager.tsx'),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const queryKey = ['recruitments', '42', 'applications', 2];
  client.setQueryData(queryKey, [row]);
  client
    .getQueryCache()
    .find({ queryKey, exact: true })
    .setState({ status: 'error', error: new Error('목록 조회 실패') });
  try {
    const html = renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(ApplicationManager, {
          recruitmentId: '42',
          userId: 2,
        }),
      ),
    );
    assert.match(html, /role="alert"/);
    assert.match(html, /목록 조회 실패/);
    assert.match(html, /다시 시도/);
    assert.equal(html.includes('student@example.com'), false);
    assert.equal(html.includes('아직 지원자가 없습니다'), false);
  } finally {
    client.clear();
  }
});
