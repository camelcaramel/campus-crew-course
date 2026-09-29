# Campus Crew Session 29 Production Deployment Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Preserve earlier lesson commits and record verification evidence.

**Goal:** Prepare and, where account access permits, deploy Campus Crew through Neon DB → Render API → Vercel Web → real browser smoke.

**Architecture:** Keep Browser → same-origin `/api/*` → Next external rewrite → Nest → PrismaPg → PostgreSQL. Add only deployment configuration, a production migration command, explicit public host binding, and a student deployment checklist. Keep the existing cookie/auth implementation unless verification finds a defect.

**Tech Stack:** Existing Node 22 / npm 10 workspaces, Nest 11.2.3, Next 16.3.4, Prisma 7.10.0 and Playwright 1.63.0. No framework upgrades.

**Spec:** User request A–K, 2026-09-23, is the authoritative design and authorization to write this plan and execute it inline.

## Global constraints

- Base `dc0b061` (session 28); branch `chore/session-29-production-deploy`; separate session-29 worktree. Preserve sessions 4–28.
- Never reset/clean/force push, rewrite old commits, use production `migrate dev`, reset production DB, or automatically seed production.
- No secrets in tracked files, terminal output, browser reports, screenshots, or commit messages.
- Verify scripts against the real repository; render root is repository root, Vercel root is `apps/web` with root workspace install.
- Hosted browser requests stay on the web origin; no public backend environment variable or direct-browser CORS workaround.
- Deployment is complete only after real hosted smoke. Mark local production-mode evidence separately.

## Review focus

1. Missing Vercel backend URL must fail before publishing a localhost proxy.
2. Next rewrite must preserve login Set-Cookie, subsequent Cookie and logout expiry; retain Secure/HttpOnly/Lax and no Domain.
3. Build installs compiler/Prisma devDependencies even when NODE_ENV=production; generated `dist/src/main.js` starts.
4. `migrate deploy` failure must stop the selected deployment sequence before starting the API; no production seed.
5. Build-time rewrites, root lockfile and Node 22 must be explicit across local/CI/hosting; remote CI cannot be inferred from local checks.

## Task 1: Audit and establish baseline

- [x] Locate clean session-28 worktree and preserve its HEAD; create separate output worktree.
- [x] Read scripts/workspaces/Prisma config/schema/seed runner/Next rewrite/Nest bootstrap/cookie/env/CI.
- [x] Inspect remote CI availability: GitHub has no `dc0b061` ref; no session-28 workflow result can be claimed.
- [x] Install exact lockfile with `npm ci --include=dev`; run baseline tests with a new loopback `_test` DB.
- [x] Confirm current official Neon pooling, Render host/PORT/pre-deploy and Vercel workspace requirements.

## Task 2: Minimal deployment changes

**Files:** root and API package.json; package-lock.json (engine metadata only); apps/web/package.json; apps/api/src/main.ts; apps/web/next.config.ts; apps/web/test/deployment-config.test.mjs; .env examples; .github/workflows/ci.yml.

- [x] Add regression tests that execute the real Next config: API_BASE_URL takes precedence, historical API_ORIGIN works locally, default localhost works locally, Vercel missing URL and non-HTTPS/loopback targets are rejected. Observe failures before implementation.
- [x] Keep external rewrite and use server-only API_BASE_URL first, legacy API_ORIGIN second, localhost last. Require a public HTTPS origin on Vercel. Strip only optional trailing slash; reject malformed URL without echoing it.
- [x] Change `await app.listen(port)` to `await app.listen(port, '0.0.0.0')`; retain existing PORT validation.
- [x] Add API `db:migrate:deploy: prisma migrate deploy` and root forwarding command; retain API prebuild generate and compiled start path.
- [x] Constrain deployment to existing Node 22 major; update lockfile engine metadata without dependency upgrades.
- [x] Update current examples and CI to API_BASE_URL; retain old lesson documentation and API_ORIGIN compatibility.
- [x] Run focused tests, format, lint, API/web tests and builds.

## Task 3: Deployment checklist and production-mode verification

**Files:** docs/deployment.md; README.md. Scratch verification scripts/logs stay in the task's `work/` directory.

- [x] Document GitHub main/CI gate, then Neon pooled DATABASE_URL + explicit `npm run db:migrate:deploy`, no seed, Render root/build/start/health/env, then Vercel root/install/build/env.
- [x] Render build: `npm ci --include=dev && npm run build -w apps/api`. Start: `npm run start -w apps/api`. Manual migration is required before deployment on every schema change; paid pre-deploy can run `npm run db:migrate:deploy` instead.
- [x] Vercel root `apps/web`, external source access enabled, install `cd ../.. && npm ci --include=dev`, build `npm run build`, output default `.next`, Node 22.x. No DATABASE_URL/JWT_SECRET on Vercel.
- [x] Verify compiled build/start using local isolated DB; inspect bound host/PORT and rewrite manifest. Run existing Playwright smoke.
- [x] Run local production-mode real browser login/reload/me/create/list/detail/apply/cancel/logout flow and verify cookie attributes/forwarding without printing values. Clearly label loopback browser results as not hosted HTTPS proof.
- [x] If accounts are connected, follow Neon → migration → Render → Vercel order and run actual hosted smoke. Otherwise record login/account blocker and exact user dashboard steps; never invent URLs or success.
- [x] Include troubleshooting, safe read-only DB verification, cleanup of only explicitly identified smoke records, local/CI/production distinctions, and session-30 incident → fix → PR → CI → redeploy → v1.0.

## Task 4: Review and commit

- [x] Check final diff and preservation of migrations, seeds, dependencies and earlier lesson files.
- [x] Obtain independent final code review, resolve consequential findings, verify relevant checks.
- [x] Prepare the reviewed changes for the requested `chore: prepare production deployment` commit; retain the branch/worktree. The actual commit is recorded in Git history and the final task report.

## Execution rulings and evidence

- Ruling: detailed user scope already authorizes plan then execution; do not repeat design approval gates. Use existing projectless-task worktree convention under outputs; native creation only operates on the calling task repository, which this task lacks.
- Ruling: no account secrets were supplied. Neon browser is at login and Neon/Vercel plugins are not connected. Repo preparation proceeds independently.
- Baseline source audit: cookie options already correct; Prisma `prebuild` already generates; PrismaPg and CLI both consume DATABASE_URL; no DIRECT_DATABASE_URL required by current code. Remote session-28 ref not found, so CI green remains a real deployment gate.

## Final local evidence and remaining gates

- Exact npm ci completed with 1028 packages; lockfile diff is engine metadata only. Vercel's root-install/web-build sequence passed with NODE_ENV=production and no DATABASE_URL.
- format:check and lint passed. API Jest/Supertest 63/63, web tests 80/80 (including 9 new config regressions) passed. Config tests were 1 pass/8 expected failures before the change, then 9/9 green.
- API prebuild/generate/build and Next production build passed; compiled API honors PORT=10000 and listens on 0.0.0.0 with DB health 200.
- A new loopback session29_test DB received the existing migration; explicit db:migrate:deploy rerun reported no pending migrations. No historical DB reset/seed modification.
- Existing Chromium smoke passed. Additional production-mode Chromium flow passed signup/login/cookie attributes and storage/reload/me/create/list/detail/apply/cancel/logout401, all browser requests same-origin. Exact test records were cleaned.
- Local HTTP Secure-cookie behavior is not hosted HTTPS evidence. Neon login/account connection and GitHub publication/CI remain gates before Neon -> Render -> Vercel -> hosted browser smoke. No cloud resources, URLs or production test data created.
- Ruling: Neon currently publishes pooled migration support and a direct-oriented Prisma guide. Keep a single DATABASE_URL; document migration-only direct override when an actual pooled error is diagnosed. No DIRECT_DATABASE_URL added without an observed requirement; hosted compatibility remains unverified.
- Ruling: current app has an API-only signup, not a /signup page; instructions use Vercel same-origin signup API. No signup UI added.
- Local environment: normal sandbox blocked browser start/teardown; only this task's identified child processes were stopped, then elevated local browser verification passed. npm registry/Docker access required approved elevated execution. No automatic approval review rejection occurred.
- Independent read-only reviewer found no consequential issue and independently passed 9 config tests plus diff whitespace check. Declined hosted Neon/TLS/accounts/remote CI judgment is accepted as an explicit remaining deployment gate, not inferred success. No minor findings.
- Existing Prisma CLI dependency audit reports 4 high entries; no forced fix or Prisma downgrade performed. Runtime relevance remains a separate review, documented in deployment.md.
- Earlier source worktree remains clean at dc0b061; existing migrations/seeds/auth/recruitment/application/UI source unchanged. No push, merge, amended history or destructive Git command used.
