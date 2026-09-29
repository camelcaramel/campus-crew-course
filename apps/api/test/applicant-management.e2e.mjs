import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

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

const run = 'session25-' + Date.now();
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
const mine = (id = posts[0], cookie = cookies[1]) =>
  request(id, 'my-application', 'GET', cookie);
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

const list = (id = posts[0], cookie = cookies[0]) =>
  request(id, 'applications', 'GET', cookie);
const decide = (
  applicationId,
  status = 'APPROVED',
  id = posts[0],
  cookie = cookies[0],
) => request(id, 'applications/' + applicationId, 'PATCH', cookie, { status });
async function fresh(userIndex = 1, postIndex = 0) {
  await db.query(
    'DELETE FROM applications WHERE "recruitmentId"=$1 AND "applicantId"=$2',
    [posts[postIndex], users[userIndex]],
  );
  const result = await db.query(
    'INSERT INTO applications (message,"recruitmentId","applicantId","updatedAt") VALUES ($1,$2,$3,NOW()) RETURNING id',
    ['참여하고 싶습니다.', posts[postIndex], users[userIndex]],
  );
  return result.rows[0].id;
}
function publicApplication(row, status) {
  assert.deepEqual(Object.keys(row).sort(), [
    'applicant',
    'createdAt',
    'id',
    'message',
    'status',
  ]);
  assert.deepEqual(Object.keys(row.applicant).sort(), ['email', 'id', 'name']);
  assert.equal(row.status, status);
  assert.equal(typeof row.message, 'string');
  assert.ok(!Number.isNaN(Date.parse(row.createdAt)));
  assert.equal(JSON.stringify(row).includes('passwordHash'), false);
}

test('owner endpoints require a valid JWT', async () => {
  for (const cookie of ['', 'access_token=invalid']) {
    assert.equal((await list(posts[0], cookie)).status, 401);
    assert.equal((await decide(1, 'APPROVED', posts[0], cookie)).status, 401);
  }
});
test('missing recruitment is 404 before ownership checks', async () => {
  await error(await list(-1), 404, 'RECRUITMENT_NOT_FOUND');
  await error(await decide(1, 'APPROVED', -1), 404, 'RECRUITMENT_NOT_FOUND');
});
test('non-owner cannot read or decide even with a valid application id', async () => {
  const id = await fresh();
  await error(await list(posts[0], cookies[1]), 403, 'APPLICATION_FORBIDDEN');
  await error(
    await decide(id, 'APPROVED', posts[0], cookies[1]),
    403,
    'APPLICATION_FORBIDDEN',
  );
  assert.equal(
    (await db.query('SELECT status FROM applications WHERE id=$1', [id]))
      .rows[0].status,
    'PENDING',
  );
});
test('owner receives an empty array and no-store on an empty recruitment', async () => {
  const response = await list(posts[1]);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), []);
});
test('owner list includes only this recruitment and safe applicant fields', async () => {
  const id = await fresh();
  await fresh(2, 1);
  const response = await list();
  assert.equal(response.status, 200);
  const rows = await response.json();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, id);
  publicApplication(rows[0], 'PENDING');
  assert.deepEqual(rows[0].applicant, {
    id: users[1],
    name: '지원테스트1',
    email: run + '-1@example.com',
  });
});
test('unknown application and mismatched recruitment/application return 404', async () => {
  const id = await fresh(2, 1);
  await error(await decide(-1), 404, 'APPLICATION_NOT_FOUND');
  await error(await decide(id), 404, 'APPLICATION_NOT_FOUND');
});
test('DTO rejects PENDING, arbitrary values and missing status', async () => {
  const id = await fresh();
  for (const body of [
    {},
    { status: 'PENDING' },
    { status: 'approved' },
    { status: 'OTHER' },
    { status: null },
    { status: 1 },
    { status: ['APPROVED'] },
  ]) {
    assert.equal(
      (await request(posts[0], 'applications/' + id, 'PATCH', cookies[0], body))
        .status,
      400,
    );
  }
  assert.equal(
    (await db.query('SELECT status FROM applications WHERE id=$1', [id]))
      .rows[0].status,
    'PENDING',
  );
});
test('invalid numeric route ids return 400 instead of an internal error', async () => {
  for (const id of ['bad', '2147483648', '9007199254740993']) {
    assert.equal((await list(id)).status, 400);
    assert.equal((await decide(id)).status, 400);
  }
});
for (const status of ['APPROVED', 'REJECTED']) {
  test(`PENDING -> ${status} persists, is public and appears in my-application`, async () => {
    const id = await fresh();
    const response = await decide(id, status);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const row = await response.json();
    assert.equal(row.id, id);
    publicApplication(row, status);
    assert.equal(
      (await db.query('SELECT status FROM applications WHERE id=$1', [id]))
        .rows[0].status,
      status,
    );
    assert.equal((await (await mine()).json()).application.status, status);
    for (const next of ['APPROVED', 'REJECTED'])
      await error(await decide(id, next), 409, 'APPLICATION_INVALID_STATUS');
    await error(
      await request(posts[0], 'applications/me', 'DELETE', cookies[1]),
      409,
      'APPLICATION_INVALID_STATUS',
    );
  });
}
test('closed recruitment still allows the owner to decide existing pending applications', async () => {
  const id = await fresh(2, 1);
  assert.equal((await decide(id, 'REJECTED', posts[1])).status, 200);
});
test('concurrent decisions produce one winner and cannot reverse the stored decision', async () => {
  const id = await fresh();
  const responses = await Promise.all([
    decide(id, 'APPROVED'),
    decide(id, 'REJECTED'),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const winner = await responses.find((r) => r.status === 200).json();
  await error(
    responses.find((r) => r.status === 409),
    409,
    'APPLICATION_INVALID_STATUS',
  );
  assert.equal(
    (await db.query('SELECT status FROM applications WHERE id=$1', [id]))
      .rows[0].status,
    winner.status,
  );
});
test('concurrent cancellation and approval cannot remove a decided application', async () => {
  const id = await fresh();
  const [approval, cancellation] = await Promise.all([
    decide(id),
    request(posts[0], 'applications/me', 'DELETE', cookies[1]),
  ]);
  if (approval.status === 200) {
    assert.equal(cancellation.status, 409);
    assert.equal(
      (await db.query('SELECT status FROM applications WHERE id=$1', [id]))
        .rows[0].status,
      'APPROVED',
    );
  } else {
    await error(approval, 404, 'APPLICATION_NOT_FOUND');
    assert.equal(cancellation.status, 204);
    assert.equal(
      (await db.query('SELECT id FROM applications WHERE id=$1', [id]))
        .rowCount,
      0,
    );
  }
});
test('expected account header protects stale owner screens', async () => {
  const id = await fresh();
  for (const [suffix, method] of [
    ['applications', 'GET'],
    ['applications/' + id, 'PATCH'],
  ]) {
    const response = await globalThis.fetch(
      base + '/api/recruitments/' + posts[0] + '/' + suffix,
      {
        method,
        headers: {
          Cookie: cookies[0],
          'X-Expected-User-Id': String(users[1]),
          'Content-Type': 'application/json',
        },
        ...(method === 'PATCH'
          ? { body: JSON.stringify({ status: 'APPROVED' }) }
          : {}),
      },
    );
    await error(response, 409, 'AUTH_SESSION_CHANGED');
  }
});
