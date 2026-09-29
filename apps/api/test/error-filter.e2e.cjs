const { afterAll, beforeAll, expect, test } = require('@jest/globals');
const { Controller, Get, HttpException, Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const request = require('supertest');
const {
  ApiExceptionFilter,
} = require('../dist/src/common/api-exception.filter');

// Test-only routes exercise sanitization without breaking a real database.
class FailureController {
  unexpected() {
    throw new Error('passwordHash=secret stack private database detail');
  }
  unavailable() {
    throw new HttpException(
      {
        code: 'PRIVATE_DB_ERROR',
        message: 'passwordHash=secret',
        stack: 'private',
      },
      503,
    );
  }
  invalid() {
    throw new HttpException({ message: ['private validation detail'] }, 400);
  }
}
Controller('failures')(FailureController);
for (const method of ['unexpected', 'unavailable', 'invalid']) {
  Get(method)(
    FailureController.prototype,
    method,
    Object.getOwnPropertyDescriptor(FailureController.prototype, method),
  );
}
class FailureModule {}
Module({ controllers: [FailureController] })(FailureModule);
let app;
beforeAll(async () => {
  app = await NestFactory.create(FailureModule, { logger: false });
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();
});
afterAll(async () => {
  if (app) await app.close();
});

test.each([
  ['unexpected', 500],
  ['unavailable', 503],
])('%s hides internal details in HTTP response', async (path, statusCode) => {
  const response = await request(app.getHttpServer())
    .get(`/failures/${path}`)
    .expect(statusCode);
  expect(response.body).toEqual({
    statusCode,
    code: 'INTERNAL_SERVER_ERROR',
    message: expect.any(String),
  });
  expect(JSON.stringify(response.body)).not.toMatch(
    /passwordHash|secret|stack|private|PRIVATE_DB_ERROR/,
  );
});
test('legacy validation arrays are normalized to a string', async () => {
  const response = await request(app.getHttpServer())
    .get('/failures/invalid')
    .expect(400);
  expect(response.body).toEqual({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    message: expect.any(String),
  });
  expect(response.body.message).not.toContain('private');
});
