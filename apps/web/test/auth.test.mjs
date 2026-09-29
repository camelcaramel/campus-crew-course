import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(name) {
  let source;
  try {
    source = readFileSync(
      new URL('../src/features/auth/' + name + '.ts', import.meta.url),
      'utf8',
    );
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + compiled + '\n})')(
    require,
    compiledModule,
    compiledModule.exports,
  );
  return compiledModule.exports;
}
const api = load('api');
test('login shows the server validation message', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json(
      {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: '입력값을 확인해주세요.',
      },
      { status: 400 },
    ),
  );
  await assert.rejects(api.login({ email: 'bad', password: 'short' }), {
    message: '입력값을 확인해주세요.',
  });
});
test('login does not reject international or quoted emails allowed at signup', () => {
  const { loginSchema } = load('schema');
  for (const email of ['학생@example.com', '"student name"@example.com']) {
    assert.equal(
      loginSchema.safeParse({ email, password: 'password123' }).success,
      true,
    );
  }
});
test('me maps only 401 to logged-out and forwards cancellation', async (t) => {
  assert.equal(typeof api.getMe, 'function');
  let status = 401;
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(path, '/api/auth/me');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.signal, controller.signal);
    return new Response('{}', { status });
  });
  assert.equal(await api.getMe(controller.signal), null);
  status = 500;
  await assert.rejects(api.getMe(controller.signal), /확인/);
});
test('login uses same-origin POST and does not reveal which credential is wrong', async (t) => {
  assert.equal(typeof api.login, 'function');
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(path, '/api/auth/login');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), {
      email: 'student@example.com',
      password: 'password123',
    });
    return new Response('{"message":"Email not found"}', { status: 401 });
  });
  await assert.rejects(
    api.login({ email: 'student@example.com', password: 'password123' }),
    {
      message: '이메일 또는 비밀번호를 확인해주세요.',
    },
  );
});
test('login returns public user; logout rejects failed requests', async (t) => {
  assert.equal(typeof api.login, 'function');
  assert.equal(typeof api.logout, 'function');
  const data = { user: { id: 1, name: '학생', email: 'student@example.com' } };
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(options.method, 'POST');
    return path.endsWith('/login')
      ? Response.json(data)
      : new Response('unavailable', { status: 503 });
  });
  assert.deepEqual(
    await api.login({ email: 'student@example.com', password: 'password123' }),
    data,
  );
  await assert.rejects(api.logout(), /로그아웃/);
});
test('login validation enforces email, length and bcrypt byte/Unicode boundaries', () => {
  const { loginSchema } = load('schema');
  assert.ok(loginSchema);
  assert.equal(
    loginSchema.safeParse({
      email: 'student@example.com',
      password: 'password123',
    }).success,
    true,
  );
  for (const password of [
    'short',
    'a'.repeat(51),
    '가'.repeat(25),
    '\uD800'.repeat(8),
  ]) {
    assert.equal(
      loginSchema.safeParse({ email: 'student@example.com', password }).success,
      false,
    );
  }
  assert.equal(
    loginSchema.safeParse({ email: 'invalid', password: 'password123' })
      .success,
    false,
  );
});
