const { afterEach, expect, jest: jestTools, test } = require('@jest/globals');
const childProcess = require('node:child_process');
const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
  jestTools.restoreAllMocks();
});

test.each([
  '',
  'postgresql://localhost/campus_crew',
  'postgresql://remote.invalid/campus_crew_test',
  'postgresql://localhost/campus_crew_test?host=remote.invalid',
  'postgresql://localhost/campus_crew_test?dbname=campus_crew',
])('unsafe test URL is rejected before any child process: %s', (url) => {
  process.env.TEST_DATABASE_URL = url;
  // The real runner executes, but subprocesses are blocked to guarantee this
  // negative test cannot migrate or connect to the intentionally unsafe URL.
  jestTools.spyOn(childProcess, 'spawnSync').mockImplementation(() => {
    throw new Error('UNSAFE_CHILD_PROCESS_STARTED');
  });
  expect(() =>
    jestTools.isolateModules(() => require('./run-tests.cjs')),
  ).toThrow(/TEST_DATABASE_URL/);
});
