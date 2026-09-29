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

// Prisma DateTime uses UTC; pg otherwise interprets timestamp without timezone
// using this Windows machine's local timezone when reading the comparison rows.
pg.types.setTypeParser(1114, (value) => new Date(value + 'Z'));

config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const prefix = 'session21-e2e-' + Date.now() + '-';
const createdIds = new Set();
let server, port, baseUrl, initialRows;

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
    env: { ...process.env, PORT: String(port) },
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

function request(method, path, body) {
  return globalThis.fetch(baseUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

before(async () => {
  assert.ok(
    process.env.DATABASE_URL,
    'Set the local seeded DATABASE_URL first.',
  );
  await db.connect();
  initialRows = await snapshot();
  assert.ok(initialRows.recruitments.length > 0, 'Run db:seed first.');
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
      'DELETE FROM users WHERE id = ANY($1::int[]) AND email LIKE $2',
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

async function signup(suffix, extra = {}) {
  const response = await request('POST', '/api/auth/signup', {
    name: '김학생',
    email: prefix + suffix + '@example.com',
    password: 'password123',
    ...extra,
  });
  const body = await response.json();
  if (Number.isInteger(body.id)) createdIds.add(body.id);
  assert.equal('password' in body, false);
  assert.equal('passwordHash' in body, false);
  return { response, body };
}

test('signup returns 201 and only public fields; SQL contains cost-10 hash', async () => {
  const { response, body } = await signup('valid', {
    id: -1,
    passwordHash: 'attacker-value',
    recruitments: { create: {} },
  });
  assert.equal(response.status, 201);
  assert.deepEqual(Object.keys(body).sort(), [
    'createdAt',
    'email',
    'id',
    'name',
  ]);
  assert.ok(body.id > 0);
  assert.equal(body.name, '김학생');
  assert.ok(Number.isFinite(Date.parse(body.createdAt)));
  const row = (await db.query('SELECT * FROM users WHERE id = $1', [body.id]))
    .rows[0];
  assert.equal(row.email, body.email);
  assert.match(row.passwordHash, /^\$2[aby]\$10\$/);
  assert.notEqual(row.passwordHash, 'password123');
  const bcrypt = await import('bcryptjs');
  assert.equal(await bcrypt.compare('password123', row.passwordHash), true);
  assert.equal(await bcrypt.compare('wrong-password', row.passwordHash), false);
  const second = await signup('salt');
  assert.equal(second.response.status, 201);
  const other = (
    await db.query('SELECT "passwordHash" FROM users WHERE id=$1', [
      second.body.id,
    ])
  ).rows[0];
  assert.notEqual(row.passwordHash, other.passwordHash);
});

test('duplicate email is 409 and preserves the original user', async () => {
  const first = await signup('duplicate');
  assert.equal(first.response.status, 201);
  const second = await signup('duplicate', {
    name: '다른학생',
    password: 'different123',
  });
  assert.equal(second.response.status, 409);
  assert.deepEqual(second.body, {
    statusCode: 409,
    code: 'USER_EMAIL_ALREADY_EXISTS',
    message: '이미 사용 중인 이메일입니다.',
  });
  assert.equal(
    (await db.query('SELECT name FROM users WHERE id=$1', [first.body.id]))
      .rows[0].name,
    '김학생',
  );
});

test('concurrent same-email signup creates exactly one row', async () => {
  const results = await Promise.all([signup('race'), signup('race')]);
  assert.deepEqual(results.map((r) => r.response.status).sort(), [201, 409]);
  assert.equal(
    results.find((r) => r.response.status === 409).body.code,
    'USER_EMAIL_ALREADY_EXISTS',
  );
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS count FROM users WHERE email=$1',
        [prefix + 'race@example.com'],
      )
    ).rows[0].count,
    1,
  );
});

test('invalid, missing and nonstring input returns 400 without insertion', async () => {
  const invalid = [
    { name: '김' },
    { name: '가'.repeat(21) },
    { name: null },
    { name: 123 },
    { name: undefined },
    { email: 'not-email' },
    { email: null },
    { email: undefined },
    { password: 'short' },
    { password: 'a'.repeat(51) },
    { password: null },
    { password: 12345678 },
    { password: undefined },
    { password: '가'.repeat(25) },
  ];
  for (let i = 0; i < invalid.length; i++) {
    const { response, body } = await signup('invalid-' + i, invalid[i]);
    assert.equal(response.status, 400, JSON.stringify(invalid[i]));
    assert.equal(body.statusCode, 400);
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.equal(typeof body.message, 'string');
  }
  for (const body of [{}, null, []]) {
    const response = await request('POST', '/api/auth/signup', body);
    assert.equal(response.status, 400);
  }
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS count FROM users WHERE email LIKE $1',
        [prefix + 'invalid-%'],
      )
    ).rows[0].count,
    0,
  );
});

test('exact length boundaries and 72-byte Unicode password are accepted', async () => {
  for (const [suffix, values] of [
    ['min', { name: '학생', password: 'a'.repeat(8) }],
    ['max', { name: '가'.repeat(20), password: 'a'.repeat(50) }],
    ['unicode', { password: '가'.repeat(24) }],
  ]) {
    const { response } = await signup(suffix, values);
    assert.equal(response.status, 201);
  }
});

test('Swagger includes signup input, safe response schema and 201/400/409', async () => {
  assert.equal((await request('GET', '/docs')).status, 200);
  const document = await (await request('GET', '/docs-json')).json();
  const operation = document.paths['/api/auth/signup']?.post;
  assert.ok(operation);
  for (const status of ['201', '400', '409'])
    assert.ok(operation.responses[status]);
  const input = document.components.schemas.SignupDto;
  assert.deepEqual(input.required, ['name', 'email', 'password']);
  assert.equal(input.properties.name.minLength, 2);
  assert.equal(input.properties.password.maxLength, 50);
  const output = document.components.schemas.SignupResponseDto;
  assert.deepEqual(Object.keys(output.properties).sort(), [
    'createdAt',
    'email',
    'id',
    'name',
  ]);
});

test('malformed Unicode passwords return 400 instead of throwing', async () => {
  for (const password of ['abcde\ud800fg', 'abcde\udc00fg']) {
    const { response } = await signup('invalid-unicode', { password });
    assert.equal(response.status, 400);
  }
});

test('malformed JSON never echoes request data in an error response', async () => {
  const response = await globalThis.fetch(baseUrl + '/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"password":SECRET123}',
  });
  assert.equal(response.status, 400);
  const text = await response.text();
  assert.equal(text.includes('SECRET123'), false);
  assert.equal(text.includes('password'), false);
});
