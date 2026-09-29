import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import process from 'node:process';
import { after, before, test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath, URL } from 'node:url';
import { config } from 'dotenv';
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';

// Prisma DateTime uses UTC; pg otherwise interprets timestamp without timezone
// using this Windows machine's local timezone when reading the comparison rows.
pg.types.setTypeParser(1114, (value) => new Date(value + 'Z'));

config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const prefix = 'session17-e2e-' + Date.now() + '-';
const createdIds = new Set();
let server, port, baseUrl, initialRows, author, ownerCookie, otherCookie;
const secret = randomBytes(32).toString('hex');
const jwt = new JwtService({ secret });
function cookieFor(user, options = {}) {
  return (
    'access_token=' +
    jwt.sign(
      { sub: user.id, email: user.email },
      { expiresIn: '1h', ...options },
    )
  );
}

async function snapshot() {
  const result = {};
  for (const table of ['users', 'recruitments', 'applications']) {
    const fields =
      table === 'users' ? 'id, email, name, "createdAt", "updatedAt"' : '*';
    result[table] = (
      await db.query('SELECT ' + fields + ' FROM ' + table + ' ORDER BY id')
    ).rows;
  }
  return result;
}

async function startServer() {
  let output = '';
  const entry = new URL('../dist/src/main.js', import.meta.url);
  server = spawn(process.execPath, [fileURLToPath(entry)], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    env: { ...process.env, PORT: String(port), JWT_SECRET: secret },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => {
    output += chunk;
  });
  server.stderr.on('data', (chunk) => {
    output += chunk;
  });
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      if ((await globalThis.fetch(baseUrl)).ok) return;
    } catch {
      /* Wait for this child process to listen. */
    }
    if (server.exitCode !== null) break;
    await setTimeout(100);
  }
  throw new Error('API did not start: ' + output);
}

async function stopServer() {
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill();
    await exited;
  }
}

function request(method, path, body, cookie = ownerCookie) {
  return globalThis.fetch(baseUrl + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function createRow(suffix, extra = {}) {
  const response = await request('POST', '/api/recruitments', {
    title: prefix + suffix,
    content: '실제 DB CRUD 테스트용 모집글',
    category: 'STUDY',
    ...extra,
  });
  const row = await response.json();
  if (Number.isInteger(row.id)) createdIds.add(row.id);
  assert.equal(response.status, 201);
  return row;
}

before(async () => {
  assert.ok(
    process.env.DATABASE_URL,
    'Set the local seeded DATABASE_URL first.',
  );
  await db.connect();
  initialRows = await snapshot();
  assert.ok(initialRows.recruitments.length > 0, 'Run db:seed first.');
  author = initialRows.users.find(
    ({ id }) => id === initialRows.recruitments[0].authorId,
  );
  assert.ok(author);
  ownerCookie = cookieFor(author);
  const other = initialRows.users.find((user) => user.id !== author.id);
  assert.ok(other, 'Two seed users are required.');
  otherCookie = cookieFor(other);
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  port = listener.address().port;
  await new Promise((resolve, reject) =>
    listener.close((error) => (error ? reject(error) : resolve())),
  );
  baseUrl = 'http://127.0.0.1:' + port;
  await startServer();
});

after(async () => {
  try {
    // Both the returned ids and this run's title prefix must match.
    // An old array API returning a seed id cannot delete a real seed row.
    await db.query(
      'DELETE FROM recruitments WHERE id = ANY($1::int[]) AND title LIKE $2',
      [[...createdIds], prefix + '%'],
    );
    if (initialRows)
      assert.deepEqual(
        await snapshot(),
        initialRows,
        'Existing DB rows must remain unchanged.',
      );
  } finally {
    await stopServer();
    await db.end();
  }
});

test('기존 루트 상태 응답을 보존한다', async () => {
  const response = await request('GET', '/');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    message: 'Campus Crew API is running',
  });
});

test('목록/상세가 실제 DB seed와 일치하고 author의 id/name만 노출한다', async () => {
  const response = await request('GET', '/api/recruitments');
  assert.equal(response.status, 200);
  const { items, meta } = await response.json();
  assert.deepEqual(meta, {
    page: 1,
    limit: 10,
    total: initialRows.recruitments.length,
    totalPages: Math.ceil(initialRows.recruitments.length / 10),
  });
  const expected = [...initialRows.recruitments]
    .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
    .slice(0, 10)
    .map((row) => ({
      ...row,
      author: {
        id: row.authorId,
        name: initialRows.users.find(({ id }) => id === row.authorId).name,
      },
    }));
  assert.deepEqual(items, JSON.parse(JSON.stringify(expected)));
  const detail = await request('GET', '/api/recruitments/' + items[0].id);
  assert.equal(detail.status, 200);
  assert.deepEqual(await detail.json(), items[0]);
});

test('POST는 201/OPEN으로 DB에 저장하고 입력 id/status/relation 객체는 무시한다', async () => {
  const row = await createRow('create', {
    id: -1,
    status: 'CLOSED',
    author: { create: { name: 'must-not-create' } },
  });
  assert.ok(row.id > 0);
  assert.equal(row.status, 'OPEN');
  assert.equal(row.authorId, author.id);
  assert.deepEqual(row.author, { id: author.id, name: author.name });
  const persisted = (
    await db.query('SELECT * FROM recruitments WHERE id = $1', [row.id])
  ).rows[0];
  assert.equal(persisted.title, prefix + 'create');
  const { items } = await (
    await request('GET', '/api/recruitments?q=' + encodeURIComponent(row.title))
  ).json();
  assert.deepEqual(
    items.find(({ id }) => id === row.id),
    row,
  );
});

test('26차시: 제목 검색/카테고리/페이지를 결합하고 총 개수와 안정적인 최신순을 반환한다', async () => {
  const search = prefix + 'React';
  const rows = [];
  for (const category of ['STUDY', 'STUDY', 'STUDY', 'PROJECT', 'CONTEST']) {
    rows.push(await createRow('React-' + rows.length, { category }));
  }
  await createRow('content-only', { content: search });
  // 동률 createdAt에서도 id desc로 페이지 간 순서가 고정된다.
  await db.query(
    'UPDATE recruitments SET "createdAt" = $1 WHERE id = ANY($2::int[])',
    ['2026-01-01T00:00:00Z', rows.map(({ id }) => id)],
  );
  const list = async (query) => {
    const response = await request(
      'GET',
      '/api/recruitments?' + query,
      undefined,
      '',
    );
    assert.equal(response.status, 200);
    return response.json();
  };
  const q = encodeURIComponent(search.toLowerCase());
  const first = await list('q=' + q + '&category=STUDY&page=1&limit=2');
  assert.deepEqual(first.meta, { page: 1, limit: 2, total: 3, totalPages: 2 });
  assert.deepEqual(
    first.items.map(({ id }) => id),
    [rows[2].id, rows[1].id],
  );
  assert.deepEqual(Object.keys(first.items[0].author).sort(), ['id', 'name']);
  const second = await list('q=' + q + '&category=STUDY&page=2&limit=2');
  assert.deepEqual(
    second.items.map(({ id }) => id),
    [rows[0].id],
  );
  assert.deepEqual(second.meta, { page: 2, limit: 2, total: 3, totalPages: 2 });
  const allCategories = await list('q=' + q);
  assert.equal(allCategories.meta.total, 5);
  for (const category of ['PROJECT', 'CONTEST']) {
    const filtered = await list('q=' + q + '&category=' + category);
    assert.equal(filtered.meta.total, 1);
    assert.equal(filtered.items[0].category, category);
  }
  const categoryOnly = await list('category=STUDY&limit=50');
  const expectedCount = Number(
    (
      await db.query(
        "SELECT count(*) FROM recruitments WHERE category = 'STUDY'",
      )
    ).rows[0].count,
  );
  assert.equal(categoryOnly.meta.total, expectedCount);
  assert.ok(categoryOnly.items.every((row) => row.category === 'STUDY'));
  const absent = await list('q=' + encodeURIComponent(prefix + 'absent'));
  assert.deepEqual(absent, {
    items: [],
    meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
  });
  const outside = await list('q=' + q + '&page=99&limit=2');
  assert.equal(outside.items.length, 0);
  assert.equal(outside.meta.totalPages, 3);
  assert.deepEqual(await list('q='), await list(''));
});

test('26차시: 잘못된 query는 500 대신 400으로 차단한다', async () => {
  for (const query of [
    'page=0',
    'page=-1',
    'page=1.5',
    'page=abc',
    'page=',
    'page=1e2',
    'page=9007199254740993',
    'page=2147483647&limit=50',
    'limit=0',
    'limit=-1',
    'limit=51',
    'limit=2.5',
    'limit=abc',
    'limit=',
    'category=INVALID',
    'category=study',
    'category=',
    'page=1&page=2',
    'q=a&q=b',
    'category=STUDY&category=PROJECT',
  ]) {
    assert.equal(
      (await request('GET', '/api/recruitments?' + query)).status,
      400,
      query,
    );
  }
});

test('PATCH는 허용 필드만 수정하며 생략한 내용과 작성자를 유지한다', async () => {
  const row = await createRow('patch');
  const response = await request('PATCH', '/api/recruitments/' + row.id, {
    title: prefix + 'patched',
    status: 'CLOSED',
    id: -1,
    authorId: -1,
    author: { update: { name: 'must-not-change' } },
  });
  assert.equal(response.status, 200);
  const updated = await response.json();
  assert.equal(updated.title, prefix + 'patched');
  assert.equal(updated.status, 'CLOSED');
  assert.equal(updated.content, row.content);
  assert.equal(updated.category, 'STUDY');
  assert.equal(updated.authorId, author.id);
  assert.deepEqual(updated.author, row.author);
  const second = await request('PATCH', '/api/recruitments/' + row.id, {
    content: '수정된 모집글의 상세 내용입니다.',
    category: 'PROJECT',
  });
  assert.equal(second.status, 200);
  const data = await (
    await request('GET', '/api/recruitments/' + row.id)
  ).json();
  assert.equal(data.content, '수정된 모집글의 상세 내용입니다.');
  assert.equal(data.category, 'PROJECT');
  assert.equal(data.status, 'CLOSED');
  const unchanged = await request('PATCH', '/api/recruitments/' + row.id, {});
  assert.equal(unchanged.status, 200);
  assert.equal((await unchanged.json()).title, prefix + 'patched');
});

test('없는 모집글의 GET/PATCH/DELETE는 404다', async () => {
  for (const method of ['GET', 'PATCH', 'DELETE']) {
    const response = await request(
      method,
      '/api/recruitments/-1',
      method === 'PATCH' ? { title: '없는 글' } : undefined,
    );
    assert.equal(response.status, 404);
    assert.equal((await response.json()).statusCode, 404);
  }
});

test('숫자가 아닌 경로 id는 400이다', async () => {
  for (const method of ['GET', 'PATCH', 'DELETE']) {
    const response = await request(
      method,
      '/api/recruitments/not-a-number',
      method === 'PATCH' ? {} : undefined,
    );
    assert.equal(response.status, 400);
  }
});

test('body authorId는 무시되고 현재 사용자 id로만 생성된다', async () => {
  for (const authorId of [
    -1,
    2147483647,
    '1',
    null,
    1.5,
    initialRows.users.find((user) => user.id !== author.id).id,
  ]) {
    const row = await createRow('spoof-author', { authorId });
    assert.equal(row.authorId, author.id);
  }
});

test('token 없음/invalid/expired/위조/없는 사용자/잘못된 sub는 mutation 401이다', async () => {
  const cookies = [
    '',
    'access_token=invalid',
    cookieFor(author, { expiresIn: -1 }),
    'access_token=' +
      new JwtService({ secret: randomBytes(32).toString('hex') }).sign({
        sub: author.id,
        email: author.email,
      }),
    cookieFor({ id: -1, email: author.email }),
    cookieFor({ id: 2147483647, email: author.email }),
  ];
  for (const cookie of cookies) {
    const row = await createRow('protected', { authorId: author.id });
    for (const method of ['POST', 'PATCH', 'DELETE']) {
      const path =
        '/api/recruitments' + (method === 'POST' ? '' : '/' + row.id);
      const response = await request(
        method,
        path,
        method === 'DELETE'
          ? undefined
          : {
              title: prefix + 'unauthorized',
              content: '내용',
              category: 'STUDY',
              authorId: author.id,
            },
        cookie,
      );
      const body = response.status === 204 ? null : await response.json();
      if (method === 'POST' && Number.isInteger(body?.id))
        createdIds.add(body.id);
      assert.equal(
        response.status,
        401,
        method + ' must authenticate before controller',
      );
    }
    assert.deepEqual(
      await (
        await request('GET', '/api/recruitments/' + row.id, undefined, '')
      ).json(),
      row,
    );
  }
});

test('다른 사용자는 PATCH/DELETE 403이며 원본과 작성자가 유지된다', async () => {
  const row = await createRow('owner-check', { authorId: author.id });
  for (const method of ['PATCH', 'DELETE']) {
    const response = await request(
      method,
      '/api/recruitments/' + row.id,
      method === 'PATCH'
        ? { title: prefix + 'forbidden', authorId: author.id }
        : undefined,
      otherCookie,
    );
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, 'RECRUITMENT_FORBIDDEN');
  }
  assert.deepEqual(
    await (await request('GET', '/api/recruitments/' + row.id)).json(),
    row,
  );
  for (const method of ['PATCH', 'DELETE']) {
    assert.equal(
      (
        await request(
          method,
          '/api/recruitments/-1',
          method === 'PATCH' ? {} : undefined,
          otherCookie,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await request(
          method,
          '/api/recruitments/-1',
          method === 'PATCH' ? {} : undefined,
          '',
        )
      ).status,
      401,
    );
  }
});

test('auth/me와 Guard가 같은 안전한 DB identity를 사용한다', async () => {
  const response = await request('GET', '/api/auth/me');
  assert.equal(response.status, 200);
  const { user } = await response.json();
  assert.deepEqual(user, {
    id: author.id,
    name: author.name,
    email: author.email,
  });
  const row = await createRow('identity');
  assert.equal(row.authorId, user.id);
  assert.equal(row.author.name, user.name);
  assert.equal(JSON.stringify(row).includes('passwordHash'), false);
});

test('DB 정수 범위를 벗어나는 경로 id는 500 대신 400이다', async () => {
  for (const id of ['2147483648', '-2147483649', '9007199254740993']) {
    for (const method of ['GET', 'PATCH', 'DELETE']) {
      const response = await request(
        method,
        '/api/recruitments/' + id,
        method === 'PATCH' ? {} : undefined,
      );
      assert.equal(response.status, 400);
    }
  }
});

test('생성/수정한 데이터와 seed가 API 재시작 후에도 유지된다', async () => {
  const row = await createRow('persistence');
  const patch = await request('PATCH', '/api/recruitments/' + row.id, {
    status: 'CLOSED',
  });
  assert.equal(patch.status, 200);
  const expected = await patch.json();
  await stopServer();
  await startServer();
  const detail = await request('GET', '/api/recruitments/' + row.id);
  assert.equal(detail.status, 200);
  assert.deepEqual(await detail.json(), expected);
  const seed = await request(
    'GET',
    '/api/recruitments/' + initialRows.recruitments[0].id,
  );
  assert.equal(seed.status, 200);
  assert.equal((await seed.json()).title, initialRows.recruitments[0].title);
});

test('DELETE는 빈 204 응답이고 이후 GET/PATCH/DELETE는 404다', async () => {
  const row = await createRow('delete');
  const response = await request('DELETE', '/api/recruitments/' + row.id);
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.equal(
    (await db.query('SELECT id FROM recruitments WHERE id = $1', [row.id]))
      .rowCount,
    0,
  );
  for (const method of ['GET', 'PATCH', 'DELETE']) {
    assert.equal(
      (
        await request(
          method,
          '/api/recruitments/' + row.id,
          method === 'PATCH' ? {} : undefined,
        )
      ).status,
      404,
    );
  }
});

test('Swagger /docs 및 명세에 CRUD와 최소 DTO가 노출된다', async () => {
  const ui = await request('GET', '/docs');
  assert.equal(ui.status, 200);
  assert.match(await ui.text(), /swagger-ui/);
  const document = await (await request('GET', '/docs-json')).json();
  assert.ok(document.paths['/api/recruitments'].get);
  assert.ok(document.paths['/api/recruitments'].post.responses['201']);
  const detail = document.paths['/api/recruitments/{id}'];
  assert.ok(detail.get);
  assert.ok(detail.patch);
  assert.ok(detail.delete.responses['204']);
  const create = document.components.schemas.CreateRecruitmentDto;
  assert.deepEqual(create.required, ['title', 'content', 'category']);
  for (const operation of [
    document.paths['/api/recruitments'].post,
    detail.patch,
    detail.delete,
  ]) {
    assert.deepEqual(operation.security, [{ cookie: [] }]);
    assert.ok(operation.responses['401']);
  }
  assert.ok(detail.patch.responses['403']);
  assert.ok(detail.delete.responses['404']);
  assert.equal(document.paths['/api/recruitments'].get.security, undefined);
  const update = document.components.schemas.UpdateRecruitmentDto;
  assert.equal(update.required?.length ?? 0, 0);
  assert.deepEqual(Object.keys(update.properties).sort(), [
    'category',
    'content',
    'status',
    'title',
  ]);
});
