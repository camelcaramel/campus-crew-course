import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { createServer } from 'node:net';
import process from 'node:process';
import { after, before, test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath, URL } from 'node:url';
import { config } from 'dotenv';
import pg from 'pg';

config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const require = createRequire(import.meta.url);
const run = 'session24-' + Date.now();
let child, base, original;
const users = [],
  posts = [],
  cookies = [];
async function snapshot() {
  const result = [];
  for (const table of ['users', 'recruitments', 'applications']) {
    result.push(
      (await db.query('SELECT * FROM ' + table + ' ORDER BY id')).rows,
    );
  }
  return JSON.stringify(result);
}
function request(id, suffix, method = 'GET', cookie, body) {
  return globalThis.fetch(base + '/api/recruitments/' + id + '/' + suffix, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function error(response, status, code) {
  assert.equal(response.status, status);
  const data = await response.json();
  assert.equal(data.statusCode, status);
  assert.equal(data.code, code);
  assert.equal(typeof data.message, 'string');
}
const apply = (
  id = posts[0],
  cookie = cookies[1],
  message = '함께 참여하고 싶습니다.',
) => request(id, 'applications', 'POST', cookie, { message });
const mine = (id = posts[0], cookie = cookies[1]) =>
  request(id, 'my-application', 'GET', cookie);
const cancel = (id = posts[0], cookie = cookies[1]) =>
  request(id, 'applications/me', 'DELETE', cookie);
before(async () => {
  await db.connect();
  original = await snapshot();
  const listener = createServer().listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  base = 'http://127.0.0.1:' + port;
  child = spawn(
    process.execPath,
    [fileURLToPath(new URL('../dist/src/main.js', import.meta.url))],
    {
      env: {
        ...process.env,
        PORT: String(port),
        JWT_SECRET: randomBytes(32).toString('hex'),
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  child.stdout.on('data', (d) => {
    output += d;
  });
  child.stderr.on('data', (d) => {
    output += d;
  });
  let ready = false;
  for (let i = 0; i < 150; i++) {
    try {
      if ((await globalThis.fetch(base)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* startup */
    }
    if (child.exitCode !== null) break;
    await setTimeout(100);
  }
  assert.ok(ready, output);
  for (let i = 0; i < 3; i++) {
    const body = {
      email: run + '-' + i + '@example.com',
      name: '지원테스트' + i,
      password: 'password123',
    };
    const response = await globalThis.fetch(base + '/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 201);
    users.push((await response.json()).id);
    const login = await globalThis.fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal(login.status, 200);
    cookies.push(login.headers.get('set-cookie').split(';')[0]);
  }
  for (const status of ['OPEN', 'CLOSED']) {
    const result = await db.query(
      'INSERT INTO recruitments (title, content, category, status, "authorId", "updatedAt") VALUES ($1,$2,\'STUDY\',$3,$4,NOW()) RETURNING id',
      [run, '지원 검증용 모집글입니다.', status, users[0]],
    );
    posts.push(result.rows[0].id);
  }
});
after(async () => {
  try {
    await db.query(
      'DELETE FROM recruitments WHERE id = ANY($1::int[]) AND title=$2',
      [posts, run],
    );
    await db.query(
      'DELETE FROM users WHERE id = ANY($1::int[]) AND email LIKE $2',
      [users, run + '%'],
    );
    assert.ok(
      (await snapshot()) === original,
      'Existing users/recruitments/applications must remain unchanged',
    );
  } finally {
    if (child?.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    await db.end();
  }
});

test('all three application endpoints require authentication', async () => {
  for (const [suffix, method] of [
    ['applications', 'POST'],
    ['my-application', 'GET'],
    ['applications/me', 'DELETE'],
  ]) {
    for (const cookie of [undefined, 'access_token=invalid']) {
      assert.equal(
        (
          await request(
            posts[0],
            suffix,
            method,
            cookie,
            method === 'POST' ? { message: '지원합니다' } : undefined,
          )
        ).status,
        401,
      );
    }
  }
});
test('own application lookup returns null and cannot cache private responses', async () => {
  const response = await mine();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(await response.json(), { application: null });
});

test('stale account headers cannot read, create or cancel under a different cookie identity', async () => {
  for (const [suffix, method] of [
    ['my-application', 'GET'],
    ['applications', 'POST'],
    ['applications/me', 'DELETE'],
  ]) {
    const response = await globalThis.fetch(
      `${base}/api/recruitments/${posts[0]}/${suffix}`,
      {
        method,
        headers: {
          Cookie: cookies[1],
          'Content-Type': 'application/json',
          'X-Expected-User-Id': String(users[2]),
        },
        ...(method === 'POST'
          ? { body: JSON.stringify({ message: '다른 계정 요청' }) }
          : {}),
      },
    );
    await error(response, 409, 'AUTH_SESSION_CHANGED');
  }
  assert.deepEqual(await (await mine()).json(), { application: null });
  const matching = await globalThis.fetch(
    `${base}/api/recruitments/${posts[0]}/my-application`,
    {
      headers: { Cookie: cookies[1], 'X-Expected-User-Id': String(users[1]) },
    },
  );
  assert.equal(matching.status, 200);
});
test('self and closed applications are rejected without DB rows', async () => {
  await error(
    await apply(posts[0], cookies[0]),
    409,
    'APPLICATION_SELF_NOT_ALLOWED',
  );
  await error(await apply(posts[1]), 409, 'RECRUITMENT_CLOSED');
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS count FROM applications WHERE "recruitmentId"=ANY($1::int[])',
        [posts],
      )
    ).rows[0].count,
    0,
  );
});
test('message validation rejects missing, wrong type, whitespace, one and 201 characters', async () => {
  for (const body of [
    {},
    { message: 123 },
    { message: ' ' },
    { message: '가' },
    { message: '가'.repeat(201) },
  ]) {
    assert.equal(
      (await request(posts[0], 'applications', 'POST', cookies[1], body))
        .status,
      400,
    );
  }
});
test('create derives identity and PENDING from server; duplicate and other-user cancel preserve row', async () => {
  const response = await request(posts[0], 'applications', 'POST', cookies[1], {
    message: '  함께 참여합니다  ',
    applicantId: users[2],
    status: 'APPROVED',
  });
  assert.equal(response.status, 201);
  const { application } = await response.json();
  assert.deepEqual(Object.keys(application).sort(), [
    'createdAt',
    'id',
    'message',
    'status',
  ]);
  assert.equal(application.message, '함께 참여합니다');
  assert.equal(application.status, 'PENDING');
  const row = (
    await db.query('SELECT * FROM applications WHERE id=$1', [application.id])
  ).rows[0];
  assert.equal(row.applicantId, users[1]);
  assert.equal(row.recruitmentId, posts[0]);
  assert.equal(row.status, 'PENDING');
  assert.deepEqual(await (await mine()).json(), { application });
  await error(await apply(), 409, 'APPLICATION_ALREADY_EXISTS');
  assert.deepEqual(await (await mine(posts[0], cookies[2])).json(), {
    application: null,
  });
  await error(await cancel(posts[0], cookies[2]), 404, 'APPLICATION_NOT_FOUND');
  assert.equal((await mine()).status, 200);
});
test('cancel deletes only own PENDING row, returns 204, then null and allows reapply', async () => {
  assert.equal((await apply(posts[0], cookies[2])).status, 201);
  const response = await cancel();
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.deepEqual(await (await mine()).json(), { application: null });
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS count FROM applications WHERE "applicantId"=$1 AND "recruitmentId"=$2',
        [users[1], posts[0]],
      )
    ).rows[0].count,
    0,
  );
  assert.equal(
    (await (await mine(posts[0], cookies[2])).json()).application.status,
    'PENDING',
  );
  await error(await cancel(), 404, 'APPLICATION_NOT_FOUND');
  assert.equal(
    (await apply(posts[0], cookies[1], '가'.repeat(200))).status,
    201,
  );
});
test('APPROVED and REJECTED applications remain visible but cannot be cancelled', async () => {
  for (const status of ['APPROVED', 'REJECTED']) {
    await db.query(
      'UPDATE applications SET status=$1 WHERE "applicantId"=$2 AND "recruitmentId"=$3',
      [status, users[1], posts[0]],
    );
    await error(await cancel(), 409, 'APPLICATION_INVALID_STATUS');
    assert.equal((await (await mine()).json()).application.status, status);
  }
  await db.query(
    'UPDATE applications SET status=\'PENDING\' WHERE "applicantId"=$1 AND "recruitmentId"=$2',
    [users[1], posts[0]],
  );
});
test('closing recruitment still allows viewing and cancelling an existing PENDING application', async () => {
  await db.query("UPDATE recruitments SET status='CLOSED' WHERE id=$1", [
    posts[0],
  ]);
  assert.equal((await (await mine()).json()).application.status, 'PENDING');
  assert.equal((await cancel()).status, 204);
  await db.query("UPDATE recruitments SET status='OPEN' WHERE id=$1", [
    posts[0],
  ]);
});
test('concurrent duplicate POSTs yield one 201 and one 409 with one DB row', async () => {
  const results = await Promise.all([apply(), apply()]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  await error(
    results.find((r) => r.status === 409),
    409,
    'APPLICATION_ALREADY_EXISTS',
  );
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS count FROM applications WHERE "applicantId"=$1 AND "recruitmentId"=$2',
        [users[1], posts[0]],
      )
    ).rows[0].count,
    1,
  );
});
test('a decision committed after lookup cannot be removed by pending cancellation', async () => {
  const { PrismaService } = require('../dist/src/prisma/prisma.service.js');
  const {
    ApplicationsService,
  } = require('../dist/src/modules/applications/applications.service.js');
  const prisma = new PrismaService();
  let interleaved = false;
  const racing = prisma.$extends({
    query: {
      application: {
        async findUnique({ args, query }) {
          const result = await query(args);
          if (!interleaved && result?.status === 'PENDING') {
            interleaved = true;
            // 실제 DB의 승인 커밋을 lookup과 DELETE 사이에 결정적으로 배치합니다.
            await db.query(
              "UPDATE applications SET status='APPROVED' WHERE id=$1",
              [result.id],
            );
          }
          return result;
        },
      },
    },
  });
  try {
    await assert.rejects(
      new ApplicationsService(racing).cancelMine(posts[0], users[1]),
      (exception) =>
        exception.getStatus() === 409 &&
        exception.getResponse().code === 'APPLICATION_INVALID_STATUS',
    );
    assert.ok(interleaved);
    assert.equal((await (await mine()).json()).application.status, 'APPROVED');
  } finally {
    await prisma.$disconnect();
  }
});

test('missing recruitments return consistent 404, invalid ids return 400', async () => {
  for (const [suffix, method] of [
    ['applications', 'POST'],
    ['my-application', 'GET'],
    ['applications/me', 'DELETE'],
  ]) {
    await error(
      await request(
        -1,
        suffix,
        method,
        cookies[1],
        method === 'POST' ? { message: '지원합니다' } : undefined,
      ),
      404,
      'RECRUITMENT_NOT_FOUND',
    );
    for (const id of ['invalid', '2147483648'])
      assert.equal(
        (
          await request(
            id,
            suffix,
            method,
            cookies[1],
            method === 'POST' ? { message: '지원합니다' } : undefined,
          )
        ).status,
        400,
      );
  }
});
test('Swagger documents all three routes with cookie auth and success codes', async () => {
  const document = await (await globalThis.fetch(base + '/docs-json')).json();
  for (const [suffix, verb, status] of [
    ['applications', 'post', '201'],
    ['my-application', 'get', '200'],
    ['applications/me', 'delete', '204'],
  ]) {
    const route = document.paths['/api/recruitments/{id}/' + suffix]?.[verb];
    assert.ok(route);
    assert.ok(route.security?.length);
    assert.ok(route.responses[status]);
  }
});
