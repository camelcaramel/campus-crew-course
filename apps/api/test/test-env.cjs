const { existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { loadEnvFile } = require('node:process');

function loadTestEnv() {
  const envFile = resolve(__dirname, '../../../.env.test');
  if (existsSync(envFile)) loadEnvFile(envFile);

  // Never fall back to a development/production DATABASE_URL.
  const url = new URL(process.env.TEST_DATABASE_URL || 'postgresql://invalid');
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !/^\/[a-zA-Z0-9_]+_test$/.test(url.pathname) ||
    [...url.searchParams.keys()].some((key) => key !== 'schema')
  ) {
    throw new Error(
      'TEST_DATABASE_URL must use loopback, a database ending in _test, and only the schema query parameter.',
    );
  }
  process.env.DATABASE_URL = url.toString();
  process.env.JWT_SECRET ||=
    'session-27-test-only-secret-never-use-in-production';
}

function e2eCredentials() {
  const email = process.env.E2E_EMAIL || '';
  const password = process.env.E2E_PASSWORD || '';
  // Restrict fixture updates to reserved test addresses, never lesson accounts.
  if (!/^[a-z0-9._+-]+@example\.test$/.test(email)) {
    throw new Error('E2E_EMAIL must be a lowercase address at example.test.');
  }
  if (
    password.length < 8 ||
    password.length > 50 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    throw new Error(
      'E2E_PASSWORD must be 8–50 characters and at most 72 UTF-8 bytes.',
    );
  }
  return { email, password };
}

module.exports = { loadTestEnv, e2eCredentials };
