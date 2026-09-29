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
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
let queryState;
let authState = { data: { user: { id: 1 } }, isPending: false, isError: false };
const root = fileURLToPath(new URL('../src/', import.meta.url));
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const compiledModule = { exports: {} };
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const localRequire = (name) => {
    // Route/query lifecycle inputs are controlled; the actual page/form/schema render.
    if (name === 'next/navigation')
      return {
        useParams: () => ({ id: '42' }),
        useRouter: () => ({ push() {} }),
      };
    if (name === '@/features/auth/queries')
      return { useMeQuery: () => authState };
    if (name === '@/features/recruitments/queries')
      return { useRecruitmentQuery: () => queryState };
    if (name.startsWith('@/') || name.startsWith('.')) {
      const base = name.startsWith('@/')
        ? path.join(root, name.slice(2))
        : path.resolve(path.dirname(file), name);
      for (const extension of ['.ts', '.tsx']) {
        try {
          return load(base + extension);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }
    }
    return require(name);
  };
  vm.runInThisContext('(function(require,module,exports){' + source + '\n})', {
    filename: file,
  })(localRequire, compiledModule, compiledModule.exports);
  cache.set(file, compiledModule.exports);
  return compiledModule.exports;
}
const Page = load(
  path.join(root, 'app/recruitments/[id]/edit/page.tsx'),
).default;

test('a failed background detail refetch keeps the existing edit form mounted', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(['recruitments', '42'], {
    id: 42,
    title: '기존 제목',
    content: '보존되어야 하는 기존 본문입니다.',
    category: 'PROJECT',
    status: 'OPEN',
    authorId: 1,
    author: { id: 1, name: 'teacher' },
    createdAt: '2026-09-19T00:00:00.000Z',
    updatedAt: '2026-09-19T00:00:00.000Z',
  });
  await assert.rejects(
    client.fetchQuery({
      queryKey: ['recruitments', '42'],
      queryFn: async () => {
        throw new Error('일시적 조회 실패');
      },
    }),
  );
  const state = client.getQueryState(['recruitments', '42']);
  queryState = {
    data: state.data,
    error: state.error,
    isError: true,
    isPending: false,
    isFetching: false,
    isFetchedAfterMount: true,
  };
  const html = renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(Page),
    ),
  );
  assert.match(html, /<form/);
  assert.match(html, /입력 중인 내용은 유지됩니다/);
  client.clear();
});

test('initial edit revalidation does not mount a form with old cached values', () => {
  const client = new QueryClient();
  queryState = {
    data: { title: '오래된 제목' },
    isError: false,
    isPending: false,
    isFetching: true,
    isFetchedAfterMount: false,
  };
  const html = renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(Page),
    ),
  );
  assert.doesNotMatch(html, /<form/);
  assert.doesNotMatch(html, /오래된 제목/);
  client.clear();
});

test('a deleted record shows the missing-record error even when stale data exists', () => {
  const client = new QueryClient();
  queryState = {
    data: { title: '삭제된 제목' },
    error: new Error('모집글을 찾을 수 없습니다.'),
    isError: true,
    isPending: false,
    isFetching: false,
    isFetchedAfterMount: true,
  };
  const html = renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(Page),
    ),
  );
  assert.doesNotMatch(html, /<form/);
  assert.match(html, /모집글을 찾을 수 없습니다/);
  client.clear();
});

const DetailPage = load(
  path.join(root, 'app/recruitments/[id]/page.tsx'),
).default;
const CreateForm = load(
  path.join(root, 'features/recruitments/create-recruitment-form.tsx'),
).CreateRecruitmentForm;
for (const [name, auth, owner] of [
  ['owner', { data: { user: { id: 1 } } }, true],
  ['other', { data: { user: { id: 2 } } }, false],
  ['logged-out', { data: null }, false],
  ['loading', { isPending: true }, false],
  [
    'auth-error-with-stale-owner',
    { data: { user: { id: 1 } }, isError: true },
    false,
  ],
]) {
  test('detail and edit controls: ' + name, () => {
    authState = auth;
    queryState = {
      data: {
        id: 42,
        title: '제목',
        content: '내용',
        category: 'STUDY',
        status: 'OPEN',
        author: { id: 1, name: '작성자' },
        createdAt: '2026-09-19',
      },
    };
    const client = new QueryClient();
    const render = (Component) =>
      renderToStaticMarkup(
        React.createElement(
          QueryClientProvider,
          { client },
          React.createElement(Component),
        ),
      );
    const detail = render(DetailPage);
    assert.equal(detail.includes('>수정</button>'), owner);
    assert.equal(detail.includes('>삭제</button>'), owner);
    assert.equal(/<form/.test(render(Page)), owner);
    if (name === 'logged-out') {
      assert.ok(render(CreateForm).includes('href="/login"'));
      assert.doesNotMatch(render(CreateForm), /<form/);
    }
    if (name === 'owner') assert.match(render(CreateForm), /<form/);
    client.clear();
  });
}
