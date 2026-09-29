# Campus Crew Session 27 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. The user's detailed A–H specification authorizes implementation after this plan is written.

**Goal:** Preserve sessions 4–26 while consistently validating HTTP input, normalizing errors, and testing real API requests with Jest + Supertest.

**Architecture:** Keep existing DTO locations and Nest HttpException objects. Keep HTTP setup in main.ts with a global ValidationPipe and an error-normalizing filter; Supertest targets the real bootstrapped server. Run tests against a dedicated PostgreSQL test database in the existing local Docker instance; retain the existing node:test suites.

**Tech Stack:** Nest 11.2.3, class-validator 0.15.1, class-transformer 0.5.1, Prisma 7.10.0, PostgreSQL 17, Jest, Supertest. No framework upgrades.

**Spec:** User request A–H in the current task (2026-09-23).

## Global Constraints

- Base: `9c82e7b`; new branch `feat/session-27-validation-error-api-tests`, separate session-27 worktree.
- Preserve existing history and previous lesson documents; no reset, clean, force push, migrations, or schema changes.
- Keep `{ statusCode, code, message }`, with string message and no passwordHash, request body, or stack in errors.
- `whitelist: true`, `transform: true`; discard extra properties for compatibility.
- Use existing strict query-number conversion, including page/offset upper bounds.
- No Playwright, GitHub Actions, logging framework, or frontend redesign.

## Review Focus

1. Optional PATCH fields may be omitted but explicit null must fail, preventing a Prisma null error.
2. DTO validation must reject input before any insert/update; verify rejected requests leave rows unchanged.
3. Missing authentication must retain 401 even with an invalid request body (guards run before pipes).
4. Malformed JSON and unexpected internal errors must not disclose passwords or stacks.
5. Query defaults, numeric conversion, whitelist, and author identity must survive the global-pipe change.

## Task 1: HTTP contract tests and safe database setup

**Files:** `apps/api/package.json`, `package-lock.json`, `apps/api/test/jest.config.cjs`, `apps/api/test/session-27.e2e.cjs`, `apps/api/test/run-tests.cjs`, `.env.test.example`.

**Interfaces:** Tests use built API modules from `dist`, real PostgreSQL and real JWT guards; HTTP checks run via Supertest. Test runner validates `TEST_DATABASE_URL` points to loopback and a database ending `_test`, then overrides DATABASE_URL before loading application or legacy tests.

- [x] Create isolated database `campus_crew_session27_test`; apply existing migrations and seed to that database only. Keep credentials in ignored `.env.test`.
- [x] Install Jest and Supertest without an extra TypeScript test transformer; preserve all existing versions.
- [x] Build baseline, run existing e2e on the isolated database, record results.
- [x] Add HTTP tests for list 200, unauthenticated POST 401/AUTH_REQUIRED, duplicate application 409/APPLICATION_ALREADY_EXISTS, invalid create 400/VALIDATION_ERROR, missing detail 404/RECRUITMENT_NOT_FOUND.
- [x] Add table-driven signup/login/create/update/query/application validation cases, optional PATCH success, whitelist, domain codes, malformed JSON and sanitization assertions.

Representative assertion:

```js
const response = await request(baseUrl)
  .post('/api/recruitments')
  .send({ title: 'x' });
expect(response.status).toBe(401);
expect(response.body).toEqual({
  statusCode: 401,
  code: 'AUTH_REQUIRED',
  message: expect.any(String),
});
```

- [x] Run the new tests before implementation; expect missing code and missing recruitment validators to fail.

## Task 2: DTO validation and normalized errors

**Files:** `apps/api/src/main.ts`, `apps/api/src/common/api-exception.filter.ts`, existing recruitment DTO/controller/service files, `applications.service.ts`.

**Interfaces:** main.ts installs existing parsers/cookies and the global pipe/filter. Tests spawn the built main.ts so bootstrap configuration cannot drift.

- [x] Retain existing HTTP parser/cookie setup in main.ts, including malformed JSON sanitization.
- [x] Install `new ValidationPipe({ whitelist: true, transform: true, exceptionFactory: () => new BadRequestException({ code: 'VALIDATION_ERROR', message: '입력값을 확인해주세요.' }) })`.
- [x] Normalize Nest exceptions to exactly three public fields. Use AUTH_REQUIRED for default 401; generic safe INTERNAL_SERVER_ERROR for unexpected/5xx errors. Preserve explicit domain codes. No message arrays.
- [x] Replace recruitment `Allow` decorators with IsString/Length(2,80), Length(10,2000), IsIn categories; PATCH uses ValidateIf(value !== undefined) so null is rejected; status OPEN/CLOSED.
- [x] Reuse auth and application DTOs (including existing bcrypt 72-byte guard). Remove redundant query-local ValidationPipe; retain strict Transform converter.
- [x] Add RECRUITMENT_NOT_FOUND and AUTH_REQUIRED where necessary; preserve existing application business error codes and state transitions.
- [x] Run new tests; expect all HTTP contract assertions to pass. Adjust legacy expected validation shape and short fixture content only where the new specified contract requires it.

## Task 3: Frontend compatibility, lesson notes, final verification

**Files:** `apps/web/src/lib/api-client.ts`, `apps/web/src/features/recruitments/api.ts`, auth request helpers if needed, `docs/session-27-validation-error-api-tests.md`, README, plan progress.

**Interfaces:** Shared safe message reader accepts a Response and fallback string; non-JSON errors retain friendly fallbacks. Existing application client already reads string message and code.

- [x] Read server message for failed recruitment list/create/update/delete and auth login/signup requests without replacing mutation/form architecture.
- [x] Document DTO rules, error codes, ten learning points and manual scenarios, test isolation/setup/cleanup and commands.
- [x] Run `npm run format:check`, `npm run lint`, `npm run build`, `npm test -w apps/api`, and retained legacy e2e. Verify curl validation/error JSON against real API.
- [x] Review entire diff and obtain a separate code review; resolve important findings and re-run relevant checks.
- [x] Commit once as `feat: add api validation and error handling`; verify clean branch and unchanged source worktree. Do not push or merge.
- [x] Record exact test totals and commands; explain session 28 will add Playwright smoke and CI using these test commands.

## Execution record

- Repository discovery: existing validation libraries and seven input DTOs found; recruitment create/update only had Allow. Global pipe lacked transform; list route had its own pipe. No global exception filter. Five existing node:test/PostgreSQL suites.
- Worktree created from the exact session-26 tip. Current task is projectless, so the app's current-repository worktree tool cannot target the discovered repository; used git worktree add with an explicit source and output destination.
- Planning and implementation are already explicitly requested; proceed inline without another design approval round.

- Ruling: Spawn the existing built API in Jest instead of adding TestingModule/shared bootstrap; existing database e2e already uses this pattern, and it tests main.ts itself with fewer production changes. No @nestjs/testing dependency is necessary.
- Baseline: legacy API suites 59/59 pass when run serially. An initial overlapping build/test run caused missing dist files; rerun serially resolved this without product changes.
- Red: new HTTP cases 41 failed / 5 passed before implementation (expected missing validation/codes). Green: 46/46 after implementation.
- Frontend red: server-message cases failed twice; green: 70/70 before adding login message coverage.

- Final review: fixed parser 413/415 becoming 500 (two HTTP tests first failed, then passed); rejected all test URL query options except schema (host/database override tests first failed, then passed). Five DB guard cases run with subprocesses blocked so negative tests cannot access a database.
- Verification: Jest 56/56 (48 application HTTP + 3 filter HTTP + 5 database guard), legacy API 59/59, web 71/71. Full format:check, lint and build passed. Curl confirmed page=0/signup 400 VALIDATION_ERROR, anonymous POST 401 AUTH_REQUIRED, missing detail 404 RECRUITMENT_NOT_FOUND.
- Cleanup verified: dedicated test DB returns to seed rows (3 users, 6 recruitments, 3 applications). Original session-26 worktree unchanged.
- Lockfile review: no previous package entry removed or version changed; only Jest/Supertest and their dependency entries added. Preserved existing entry order to avoid formatting churn.
- Minor review note: catch-all internal errors intentionally return only a safe public message; no logging framework added in this lesson.
- Integration decision: preserve the requested standalone feature branch/worktree with one new commit; no push, merge or history rewrite.
