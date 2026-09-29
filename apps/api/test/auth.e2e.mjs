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
import { JwtService } from '@nestjs/jwt';
import pg from 'pg';

config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const secret = randomBytes(32).toString('hex');
const jwt = new JwtService({ secret });
const email = 'session22-e2e-' + Date.now() + '@example.com';
const password = 'password123';
let child, base, user, originalUsers;

async function start(mode = 'development') {
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
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
        JWT_SECRET: secret,
        NODE_ENV: mode,
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  child.stdout.on('data', (data) => {
    output += data;
  });
  child.stderr.on('data', (data) => {
    output += data;
  });
  for (let i = 0; i < 150; i++) {
    try {
      if ((await globalThis.fetch(base)).ok) return;
    } catch {
      /* starting */
    }
    if (child.exitCode !== null) break;
    await setTimeout(100);
  }
  throw new Error(output);
}
async function stop() {
  if (child?.exitCode === null) {
    const exit = once(child, 'exit');
    child.kill();
    await exit;
  }
}
function request(path, { method = 'GET', body, cookie } = {}) {
  return globalThis.fetch(base + '/api/auth/' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
function login(body = { email, password }) {
  return request('login', { method: 'POST', body });
}
function safeUser(value) {
  assert.deepEqual(Object.keys(value).sort(), ['email', 'id', 'name']);
  assert.equal(value.email, email);
  assert.equal(value.name, '로그인학생');
}
before(async () => {
  await db.connect();
  originalUsers = (
    await db.query(
      'SELECT id, email, name, "passwordHash" FROM users ORDER BY id',
    )
  ).rows;
  await start();
  const response = await request('signup', {
    method: 'POST',
    body: { name: '로그인학생', email, password },
  });
  assert.equal(response.status, 201);
  user = await response.json();
});
after(async () => {
  try {
    if (user)
      await db.query('DELETE FROM users WHERE id=$1 AND email=$2', [
        user.id,
        email,
      ]);
    const remaining = (
      await db.query(
        'SELECT id, email, name, "passwordHash" FROM users ORDER BY id',
      )
    ).rows;
    // Do not include hashes in assertion failure output.
    assert.ok(
      JSON.stringify(remaining) === JSON.stringify(originalUsers),
      'Existing users must remain unchanged',
    );
  } finally {
    await stop();
    await db.end();
  }
});

test('missing email and wrong password have the same safe 401 response and no cookie', async () => {
  let expected;
  for (const body of [
    { email, password: 'wrongpassword' },
    { email: 'missing-' + email, password },
  ]) {
    const response = await login(body);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('set-cookie'), null);
    const json = await response.json();
    assert.equal(json.code, 'AUTH_INVALID_CREDENTIALS');
    assert.doesNotMatch(JSON.stringify(json), /passwordHash|wrongpassword/);
    if (expected) assert.deepEqual(json, expected);
    expected = json;
  }
});
test('login validates email and signup-compatible password boundaries', async () => {
  for (const body of [
    {},
    { email: 'invalid', password },
    { email, password: 'short' },
    { email, password: 'a'.repeat(51) },
    { email, password: '가'.repeat(25) },
    { email, password: 12345678 },
    { email, password: '\uD800'.repeat(8) },
  ]) {
    assert.equal((await login(body)).status, 400);
  }
});
test('login sets a one-hour HttpOnly Lax cookie and returns only public user', async () => {
  const response = await login();
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(Object.keys(data), ['user']);
  safeUser(data.user);
  const header = response.headers.get('set-cookie');
  assert.match(header, /^access_token=/);
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Path=\//);
  assert.match(header, /Max-Age=3600/);
  assert.doesNotMatch(header, /Secure/);
  assert.match(response.headers.get('cache-control'), /no-store/);
  const cookie = header.split(';')[0];
  const payload = jwt.verify(cookie.slice('access_token='.length));
  assert.deepEqual(Object.keys(payload).sort(), ['email', 'exp', 'iat', 'sub']);
  assert.equal(payload.sub, user.id);
  assert.equal(payload.email, email);
  assert.equal(payload.exp - payload.iat, 3600);
  for (let i = 0; i < 2; i++) {
    const me = await request('me', { cookie });
    assert.equal(me.status, 200);
    assert.match(me.headers.get('cache-control'), /no-store/);
    safeUser((await me.json()).user);
  }
});
test('me rejects missing, malformed, wrong signature, expired and invalid claims', async () => {
  const cookies = [
    undefined,
    'access_token=garbage',
    'access_token=j:{"sub":1}',
    'access_token=' +
      new JwtService({ secret: 'different-test-secret' }).sign({
        sub: user.id,
        email,
      }),
    ...[
      [{ sub: user.id, email }, { expiresIn: -1 }],
      [
        { sub: user.id, email },
        { algorithm: 'HS384', expiresIn: 3600 },
      ],
      [{ sub: '1', email }, { expiresIn: 3600 }],
      [{ sub: 2147483648, email }, { expiresIn: 3600 }],
      [{ sub: user.id }, { expiresIn: 3600 }],
      [{ sub: user.id, email }, {}],
    ].map(([payload, options]) => 'access_token=' + jwt.sign(payload, options)),
  ];
  for (const cookie of cookies) {
    const response = await request('me', { cookie });
    assert.equal(response.status, 401);
    assert.doesNotMatch(await response.text(), /passwordHash/);
  }
});
test('logout expires the same cookie even without a valid session', async () => {
  const loginResponse = await login();
  const cookie = loginResponse.headers.get('set-cookie')?.split(';')[0];
  for (const value of [cookie, undefined]) {
    const response = await request('logout', { method: 'POST', cookie: value });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { message: '로그아웃되었습니다.' });
    const cleared = response.headers.get('set-cookie');
    assert.match(cleared, /^access_token=;/);
    assert.match(cleared, /Expires=Thu, 01 Jan 1970/);
    assert.match(cleared, /Path=\//);
    assert.match(cleared, /HttpOnly/);
    assert.match(cleared, /SameSite=Lax/);
    assert.equal((await request('me')).status, 401);
  }
});
test('production sets Secure on both login and logout cookies', async () => {
  await stop();
  await start('production');
  assert.match((await login()).headers.get('set-cookie'), /; Secure/);
  assert.match(
    (await request('logout', { method: 'POST' })).headers.get('set-cookie'),
    /; Secure/,
  );
  await stop();
  await start();
});
test('Swagger me cookie security references the registered scheme', async () => {
  const document = await (await globalThis.fetch(base + '/docs-json')).json();
  const security = document.paths['/api/auth/me'].get.security;
  const [name] = Object.keys(security[0]);
  assert.deepEqual(document.components.securitySchemes[name], {
    type: 'apiKey',
    in: 'cookie',
    name: 'access_token',
  });
});

test('signed cookie for a deleted user is not authentication', async () => {
  const response = await login();
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  await db.query('DELETE FROM users WHERE id=$1 AND email=$2', [
    user.id,
    email,
  ]);
  assert.equal((await request('me', { cookie })).status, 401);
});
