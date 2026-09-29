const {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
} = require('@jest/globals');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { createServer } = require('node:net');
const { resolve } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const request = require('supertest');
const { Client } = require('pg');

// Removing a DTO validator, guard, domain code or database uniqueness check
// must change these HTTP results. No controller/service/Prisma mocks are used.
describe('session 27: real HTTP + PostgreSQL contracts', () => {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  const prefix = `s27-${randomUUID()}`;
  const password = 'TestPassword27!';
  let server, api, owner, applicant, ownerCookie, applicantCookie, recruitment;
  let connected = false;
  let output = '';

  async function error(result, statusCode, code) {
    const response = await result;
    expect(response.status).toBe(statusCode);
    expect(response.body).toEqual({
      statusCode,
      code,
      message: expect.any(String),
    });
    expect(response.body.message.length).toBeGreaterThan(0);
    expect(JSON.stringify(response.body)).not.toMatch(
      /passwordHash|stack|TestPassword27/,
    );
    return response;
  }
  const valid = () => ({
    title: '함께 공부할 팀원 모집',
    content: '매주 함께 공부하는 스터디입니다.',
    category: 'STUDY',
  });
  const postRecruitment = (body) =>
    api.post('/api/recruitments').set('Cookie', ownerCookie).send(body);
  const patchRecruitment = (body) =>
    api
      .patch(`/api/recruitments/${recruitment.id}`)
      .set('Cookie', ownerCookie)
      .send(body);
  const apply = (
    cookie = applicantCookie,
    body = { message: '함께 참여하고 싶습니다.' },
  ) =>
    api
      .post(`/api/recruitments/${recruitment.id}/applications`)
      .set('Cookie', cookie)
      .send(body);

  beforeAll(async () => {
    await db.connect();
    connected = true;
    const socket = createServer();
    socket.listen(0, '127.0.0.1');
    await once(socket, 'listening');
    const port = socket.address().port;
    await new Promise((done) => socket.close(done));
    api = request(`http://127.0.0.1:${port}`);
    server = spawn(
      process.execPath,
      [resolve(__dirname, '../dist/src/main.js')],
      {
        env: { ...process.env, PORT: String(port) },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    server.stdout.on('data', (chunk) => {
      output += chunk;
    });
    server.stderr.on('data', (chunk) => {
      output += chunk;
    });
    let ready = false;
    for (let attempt = 0; attempt < 150; attempt++) {
      try {
        const response = await api.get('/').timeout(500);
        if (response.status === 200) {
          ready = true;
          break;
        }
      } catch {
        /* Server is still starting. */
      }
      if (server.exitCode !== null) break;
      await delay(100);
    }
    if (!ready) throw new Error(`API failed to start: ${output}`);

    async function account(role) {
      const email = `${prefix}-${role}@example.com`;
      const signup = await api
        .post('/api/auth/signup')
        .send({ name: '테스트학생', email, password })
        .expect(201);
      const login = await api
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);
      return {
        user: signup.body,
        cookie: login.headers['set-cookie'][0].split(';')[0],
      };
    }
    ({ user: owner, cookie: ownerCookie } = await account('owner'));
    ({ user: applicant, cookie: applicantCookie } = await account('applicant'));
    recruitment = (await postRecruitment(valid()).expect(201)).body;
  });

  afterAll(async () => {
    if (server && server.exitCode === null) {
      const exited = once(server, 'exit');
      server.kill();
      await exited;
    }
    if (connected) {
      // Delete dependants first; every statement is scoped to this run's users.
      try {
        await db.query(
          'DELETE FROM applications WHERE "applicantId" IN (SELECT id FROM users WHERE email LIKE $1)',
          [`${prefix}%`],
        );
        await db.query(
          'DELETE FROM recruitments WHERE "authorId" IN (SELECT id FROM users WHERE email LIKE $1)',
          [`${prefix}%`],
        );
        await db.query('DELETE FROM users WHERE email LIKE $1', [`${prefix}%`]);
      } finally {
        await db.end();
      }
    }
  });

  test('GET list returns 200, items/meta, and numeric default pagination', async () => {
    const response = await api.get('/api/recruitments').expect(200);
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.meta).toMatchObject({ page: 1, limit: 10 });
    const filtered = await api
      .get(
        '/api/recruitments?page=1&limit=1&category=STUDY&q=' +
          encodeURIComponent(recruitment.title),
      )
      .expect(200);
    expect(filtered.body.meta).toMatchObject({ page: 1, limit: 1 });
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0].category).toBe('STUDY');
  });

  test('unauthenticated create returns 401 AUTH_REQUIRED before body validation', async () => {
    await error(
      api.post('/api/recruitments').send({ title: 'x' }),
      401,
      'AUTH_REQUIRED',
    );
  });

  test('duplicate application returns 409 and leaves exactly one database row', async () => {
    await apply().expect(201);
    await error(apply(), 409, 'APPLICATION_ALREADY_EXISTS');
    const { rows } = await db.query(
      'SELECT count(*)::int AS count FROM applications WHERE "recruitmentId"=$1 AND "applicantId"=$2',
      [recruitment.id, applicant.id],
    );
    expect(rows[0].count).toBe(1);
  });

  test('missing recruitment returns 404 RECRUITMENT_NOT_FOUND', async () => {
    await error(
      api.get('/api/recruitments/2147483647'),
      404,
      'RECRUITMENT_NOT_FOUND',
    );
  });

  test.each([
    ['title too short', { title: 'x' }],
    ['title too long', { title: 'x'.repeat(81) }],
    ['title type', { title: 123 }],
    ['content too short', { content: '짧음' }],
    ['content too long', { content: 'x'.repeat(2001) }],
    ['category', { category: 'OTHER' }],
    ['null title', { title: null }],
    ['missing fields', null],
  ])(
    'invalid create: %s returns 400 without inserting',
    async (_label, fields) => {
      const before = await db.query(
        'SELECT count(*) FROM recruitments WHERE "authorId"=$1',
        [owner.id],
      );
      await error(
        postRecruitment(fields === null ? {} : { ...valid(), ...fields }),
        400,
        'VALIDATION_ERROR',
      );
      const after = await db.query(
        'SELECT count(*) FROM recruitments WHERE "authorId"=$1',
        [owner.id],
      );
      expect(after.rows).toEqual(before.rows);
    },
  );

  test.each([
    { title: 'x' },
    { content: '짧음' },
    { category: 'OTHER' },
    { status: 'PENDING' },
    { title: null },
    { content: null },
    { category: null },
    { status: null },
  ])(
    'invalid optional PATCH %j returns 400 and preserves row',
    async (fields) => {
      const before = (await api.get(`/api/recruitments/${recruitment.id}`))
        .body;
      await error(patchRecruitment(fields), 400, 'VALIDATION_ERROR');
      expect(
        (await api.get(`/api/recruitments/${recruitment.id}`)).body,
      ).toEqual(before);
    },
  );

  test('PATCH permits omitted fields; whitelist discards authorId and unknown fields', async () => {
    await patchRecruitment({}).expect(200);
    const response = await postRecruitment({
      ...valid(),
      authorId: applicant.id,
      unexpected: 'ignored',
    }).expect(201);
    expect(response.body.authorId).toBe(owner.id);
    expect(response.body).not.toHaveProperty('unexpected');
    await patchRecruitment({ title: '수정된 모집 제목' }).expect(200);
  });

  test.each([
    'page=0',
    'page=1.5',
    'page=abc',
    'page=',
    'page=1&page=2',
    'limit=0',
    'limit=51',
    'category=OTHER',
  ])('invalid query %s returns VALIDATION_ERROR', async (query) => {
    await error(api.get(`/api/recruitments?${query}`), 400, 'VALIDATION_ERROR');
  });

  test.each([
    ['name', { name: 'x' }],
    ['name long', { name: 'x'.repeat(21) }],
    ['email', { email: 'invalid' }],
    ['password short', { password: 'short' }],
    ['password long', { password: 'x'.repeat(51) }],
    ['password type', { password: 12345678 }],
  ])('invalid signup %s returns VALIDATION_ERROR', async (_label, fields) => {
    await error(
      api.post('/api/auth/signup').send({
        name: '테스트',
        email: `${prefix}-invalid@example.com`,
        password,
        ...fields,
      }),
      400,
      'VALIDATION_ERROR',
    );
  });

  test.each([
    { email: 'bad', password },
    { email: 'valid@example.com', password: 'short' },
    { email: 'valid@example.com', password: 'x'.repeat(51) },
  ])('invalid login %j returns VALIDATION_ERROR', async (body) => {
    await error(
      api.post('/api/auth/login').send(body),
      400,
      'VALIDATION_ERROR',
    );
  });

  test('duplicate email and invalid credentials preserve explicit error codes', async () => {
    await error(
      api
        .post('/api/auth/signup')
        .send({ name: '테스트', email: owner.email, password }),
      409,
      'USER_EMAIL_ALREADY_EXISTS',
    );
    await error(
      api
        .post('/api/auth/login')
        .send({ email: owner.email, password: 'wrongPassword' }),
      401,
      'AUTH_INVALID_CREDENTIALS',
    );
  });

  test.each(['x', 'x'.repeat(201), 123, null])(
    'invalid application message %j returns VALIDATION_ERROR',
    async (message) => {
      await error(apply(applicantCookie, { message }), 400, 'VALIDATION_ERROR');
    },
  );

  test('PENDING decision is rejected by DTO; terminal status cannot change again', async () => {
    const row = (await postRecruitment(valid()).expect(201)).body;
    const created = await api
      .post(`/api/recruitments/${row.id}/applications`)
      .set('Cookie', applicantCookie)
      .send({ message: '상태 검증 지원입니다.' })
      .expect(201);
    const path = `/api/recruitments/${row.id}/applications/${created.body.application.id}`;
    await error(
      api.patch(path).set('Cookie', ownerCookie).send({ status: 'PENDING' }),
      400,
      'VALIDATION_ERROR',
    );
    await api
      .patch(path)
      .set('Cookie', ownerCookie)
      .send({ status: 'APPROVED' })
      .expect(200);
    await error(
      api.patch(path).set('Cookie', ownerCookie).send({ status: 'REJECTED' }),
      409,
      'APPLICATION_INVALID_STATUS',
    );
  });

  test('authorization, self application, missing application and closed recruitment codes', async () => {
    await error(
      api
        .patch(`/api/recruitments/${recruitment.id}`)
        .set('Cookie', applicantCookie)
        .send({ title: '다른 사용자 수정' }),
      403,
      'RECRUITMENT_FORBIDDEN',
    );
    await error(
      api
        .get(`/api/recruitments/${recruitment.id}/applications`)
        .set('Cookie', applicantCookie),
      403,
      'APPLICATION_FORBIDDEN',
    );
    await error(apply(ownerCookie), 409, 'APPLICATION_SELF_NOT_ALLOWED');
    await error(
      api
        .patch(`/api/recruitments/${recruitment.id}/applications/2147483647`)
        .set('Cookie', ownerCookie)
        .send({ status: 'REJECTED' }),
      404,
      'APPLICATION_NOT_FOUND',
    );
    await patchRecruitment({ status: 'CLOSED' }).expect(200);
    await error(apply(), 409, 'RECRUITMENT_CLOSED');
  });

  test('malformed JSON and unknown routes retain safe three-field errors', async () => {
    await error(
      api
        .post('/api/auth/signup')
        .set('Content-Type', 'application/json')
        .send('{"password":"TestPassword27!",'),
      400,
      'BAD_REQUEST',
    );
    await error(api.get('/api/does-not-exist'), 404, 'NOT_FOUND');
  });

  test('oversized JSON retains 413 instead of becoming a server error', async () => {
    await error(
      api.post('/api/auth/signup').send({ password: 'x'.repeat(110000) }),
      413,
      'PAYLOAD_TOO_LARGE',
    );
  });

  test('unsupported JSON charset retains 415 with sanitized message', async () => {
    await error(
      api
        .post('/api/auth/signup')
        .set('Content-Type', 'application/json; charset=iso-8859-1')
        .send('{"password":"TestPassword27!"}'),
      415,
      'UNSUPPORTED_MEDIA_TYPE',
    );
  });
});
