const { afterEach, expect, test } = require('@jest/globals');
const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

// These cases prevent E2E setup from changing a classroom user's password
// or creating a password the real login DTO/bcrypt cannot accept.
test.each([
  ['', 'CampusCrewE2e28!'],
  ['teacher@example.com', 'CampusCrewE2e28!'],
  ['smoke@example.test', ''],
  ['smoke@example.test', 'short'],
  ['smoke@example.test', 'a'.repeat(51)],
  ['smoke@example.test', '한'.repeat(25)],
])('invalid E2E credentials are rejected: %s', (email, password) => {
  process.env.E2E_EMAIL = email;
  process.env.E2E_PASSWORD = password;
  const { e2eCredentials } = require('./test-env.cjs');
  expect(() => e2eCredentials()).toThrow(/E2E_/);
});

test('valid disposable credentials are returned without changing the password', () => {
  process.env.E2E_EMAIL = 'smoke@example.test';
  process.env.E2E_PASSWORD = 'CampusCrewE2e28!';
  const { e2eCredentials } = require('./test-env.cjs');
  expect(e2eCredentials()).toEqual({
    email: 'smoke@example.test',
    password: 'CampusCrewE2e28!',
  });
});
