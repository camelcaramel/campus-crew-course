# Campus Crew Session 28 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Preserve all earlier lesson commits.

**Goal:** Protect the login → recruitment list → detail happy path with one real Chromium test and run the classroom quality commands in GitHub Actions.

**Architecture:** Extend the npm workspace scripts. Reuse the session 27 loopback-only `_test` database guard and migration/seed runner. Add a separate E2E fixture in the isolated database, leaving historical seed accounts untouched. Playwright starts the built Nest and Next apps itself. A single quality job runs the same commands with a PostgreSQL 17 service.

**Tech Stack:** Node 22, npm 10.9.2 workspaces, Next 16, Nest 11, Prisma 7, Jest/Supertest, Playwright Chromium, GitHub Actions.

**Spec:** User request A–G in this task, 2026-09-23 (authoritative implementation authorization).

## Global constraints

- Base commit 942ea79, branch test/session-28-playwright-ci, separate worktree.
- Preserve sessions 4–27; no reset, clean, forced push, production database or deployment.
- Ports: Next 3000, Nest 4000, PostgreSQL 5432 (local verification may use existing Docker mapping 5424).
- One browser, one worker, one happy path. No matrix, process manager, coverage gate or CD.
- E2E_EMAIL and E2E_PASSWORD come from .env.test or CI environment.
- Keep prior seed accounts and application source unchanged.

## Review focus

1. A missing/remote/non-test URL must fail before migration, seed or server start.
2. Missing/invalid E2E credentials must fail clearly, never silently skip the test.
3. Repeated fixture preparation must preserve classroom data and avoid duplicates.
4. A public list alone must not count as successful authentication; assert authenticated header and retained session.
5. Existing servers on 3000/4000 must not be silently reused with the wrong DB.

## Task 1: Add browser smoke and isolated data preparation

**Files:** root package.json/package-lock.json; apps/web/package.json, playwright.config.ts, e2e/recruitment-smoke.spec.ts; apps/api/package.json, test/run-tests.cjs, test/test-env.cjs, prisma/seed-e2e.ts; .env.test.example; ignore files.

- [x] Record baseline npm ci, format, lint and API tests using a newly created campus_crew_session28_test database.
- [x] Install an exact current @playwright/test version in the web workspace and Chromium.
- [x] Extract the existing URL guard without changing its loopback/_test restrictions. Keep its negative Jest tests passing.
- [x] Add E2E preparation through the guarded runner: migrate deploy, original seed, then dedicated fixture. Require an email in reserved example.test and an 8–50 character / max 72 byte password. bcrypt-hash password; upsert only that fixture account; reuse its fixed title/content recruitment. Never reset the DB or change teacher/student passwords.
- [x] Add the smoke using getByLabel('이메일'), getByLabel('비밀번호'), getByRole('button', {name:'로그인', exact:true}), authenticated logout control, listing heading, fixed fixture link and detail heading/content. Reload detail to verify the cookie-backed session persists. No API mocking or mutations in browser flow.
- [x] Configure baseURL http://127.0.0.1:3000, one Chromium project/worker, headless, no retries, retained failure trace/screenshot, HTML report without auto-open. Two webServer entries run existing start scripts; reuseExistingServer false. Set API_ORIGIN before build, API PORT 4000 and dummy JWT via test env.
- [x] Run a wrong-password smoke as a local negative control; observe authentication failure, restore the original environment and pass twice. Do not commit intentional failures.

## Task 2: Add CI and teaching instructions

**Files:** .github/workflows/ci.yml; docs/session-28-playwright-ci.md; README.md.

- [x] Add pull_request and push/main triggers, contents:read, ubuntu runner, Node 22, checkout/setup-node, npm cache, npm ci.
- [x] Add PostgreSQL 17 service with health check on 5432, isolated campus_crew_test, disposable CI-only credentials and JWT. No external secrets.
- [x] Run format:check → lint → test:prepare → test (API + existing web tests) → build → Chromium install → smoke. Upload failure report/results for 7 days.
- [x] Document Docker setup, separate test DB, environment copying, fixture preparation, build, smoke and report commands, port conflict handling, API vs E2E test roles, stable locators, CI logs and the 29th lesson deployment handoff.
- [x] Verify npm ci, format, lint, Jest/Supertest, web tests, build, repeated smoke and YAML structure. Review diff and commit test: add playwright smoke and ci without changing old commits.

## Execution notes

- Native worktree tool could not operate in this projectless task (Not a git repository); created a git worktree from the discovered repository at the user-facing outputs path.
- npm on this PC requires temporary npm_config_prefix=C:/Program Files/nodejs. This is a local shell workaround, not a repository dependency change.
- Docker access needs elevated tool execution; use only the existing PostgreSQL 17 container and a new session28 test database.

## Completion evidence

- npm ci: passed, 1028 packages; historical lock entries retained, 3 Playwright entries added.
- format:check and lint: passed.
- npm test: API Jest/Supertest 63 passed; web 71 passed.
- Existing API legacy regression: 59 passed.
- Prisma typecheck and API/Next build: passed.
- Chromium: default account passed twice consecutively; alternate E2E account passed.
- Negative controls: wrong password failed at login; duplicate-title bug reproduced, then fixed using account-specific title and exact search.
- Repeated fixture snapshot: no duplicates and prior lesson rows unchanged; bcrypt verified.
- CI YAML parsed and trigger/service/step structure checked. Remote GitHub Actions was not executed; no push/PR was performed.
- Application source, original seed and migrations have zero diff from 942ea79.
- Ruling: user supplied detailed implementation scope and requested plan then execution; proceeded inline without redundant approval gates. Preserve branch/worktree after the requested commit.
