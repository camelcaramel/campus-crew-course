# Campus Crew Session 30 Production Incident Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. Track actual verification separately from hosted deployment claims.

**Goal:** Reproduce a missing production API proxy setting safely, fix its cause with regression coverage, and follow PR → CI → merge → deployment → smoke where access permits.

**Architecture:** Preserve the Next external `/api/*` rewrite and Render/Neon architecture. Require explicit `API_BASE_URL` when `NODE_ENV=production` even without `VERCEL`; retain development fallback and existing Vercel HTTPS validation. Reproduce only on an isolated local production build, never by breaking a hosted environment.

**Tech Stack:** Next.js 16, NestJS 11, Prisma 7, PostgreSQL, node:test, Jest/Supertest, Playwright, GitHub Actions.

**Spec:** User's session-30 request in this task (2026-09-23), sections A–K; existing `docs/deployment.md` defines deployment settings.

## Global constraints

- Preserve all 4–29 commits. Start from `fa44bfd` in a separate clone on `fix/session-30-production-api-proxy`; original worktrees remain untouched.
- No production DB writes/reset/deletion, destructive Git commands, secret output, new dependencies, auth weakening, or broad refactoring.
- Production release requires hosted smoke, not merely a successful local build. Do not create/push a tag or GitHub Release in this run without the specified release gates and tag authorization.
- Remote main is only `8332381` (session 4). Publish the unchanged session-29 baseline and use a separate prerequisite PR before the small session-30 fix PR so review scopes remain clear. Both must pass CI before merging.
- Browser Vercel dashboard currently requires login; deployment URLs are being requested. Record an access blocker if hosted validation is unavailable.

## Review focus

1. Production without VERCEL and without API_BASE_URL must fail before generating a localhost rewrite.
2. A legacy API_ORIGIN must not hide the missing production setting.
3. Explicit local production API_BASE_URL must work for safe classroom builds.
4. Development fallback and Vercel HTTPS/origin checks must remain intact.
5. Browser login, refresh/me, list/detail, logout/me must still travel through the web origin.

## Task 1: Reproduce and prevent missing production proxy configuration

Files: `apps/web/next.config.ts`, `apps/web/test/deployment-config.test.mjs`.

- [x] Install unchanged lockfile dependencies and run baseline web tests.
- [x] With no API_BASE_URL/API_ORIGIN/VERCEL, build the original web, start it on localhost with no API on 4000, GET `/api/recruitments?limit=1`, and record HTTP 500 plus connection-refused logs. Only GET requests; no DB needed.
- [x] Add failing tests against the real transpiled Next config:

```js
await assert.rejects(destination({ NODE_ENV: 'production' }), /API_BASE_URL/);
await assert.rejects(
  destination({ NODE_ENV: 'production', API_ORIGIN: 'http://localhost:4000' }),
  /API_BASE_URL/,
);
assert.equal(
  await destination({
    NODE_ENV: 'production',
    API_BASE_URL: 'http://127.0.0.1:4000',
  }),
  'http://127.0.0.1:4000/api/:path*',
);
```

- [x] Run `node --test apps/web/test/deployment-config.test.mjs`; confirm the missing-setting rejection tests fail on baseline.
- [x] Extend the existing missing-setting condition to `(process.env.VERCEL || process.env.NODE_ENV === 'production') && !process.env.API_BASE_URL`; use a value-free diagnostic naming API_BASE_URL. Keep all other rewrite behavior.
- [x] Re-run tests; missing-env production build must now exit nonzero with the diagnostic; explicit local URL build must succeed.

## Task 2: Verify recovery and document the incident

Files: `apps/web/e2e/recruitment-smoke.spec.ts` (actual existing filename verified before edit), `docs/incident-30.md`, `README.md`.

- [x] Extend the existing browser smoke with explicit login/me/list/detail status assertions and logout → me 401. Preserve existing UI checks; use existing local test fixtures, no new production fixture creation.
- [x] Use a dedicated local `campus_crew_session30_test` database; only the existing guarded test prepare/fixture scripts may write to it.
- [x] Run `npm run format:check`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`; inspect results and resolve failures without skips.
- [x] Write `docs/incident-30.md` with title, symptom, impact, reproduction, root cause, fix, verification, prevention, 50-minute lesson flow, deployment and release gates. Add one truthful README status line.
- [x] Self-review diff, confirm original commits remain ancestors, then commit `fix: require explicit production api proxy configuration`.

## Task 3: GitHub delivery and hosted verification

- [ ] Push unchanged session-29 baseline and create prerequisite PR to main, with accurate previous-work scope. Check all CI steps; resolve any actual failure before merge.
- [ ] Push session-30 branch, create small PR against session-29 baseline with symptom/cause/fix/verification/regression details. Attach PRs to this task.
- [ ] Obtain independent whole-diff review, address consequential findings, and confirm exact PR head CI before merge. Merge prerequisite then retarget/recheck session-30 against main and merge.
- [ ] For an accessible existing deployment, set the correct production API_BASE_URL only if missing, redeploy Vercel at merged SHA, and verify build/runtime logs and browser smoke. No API code/schema changes are planned, so Render needs no redeploy for this fix.
- [ ] Hosted smoke: `/recruitments`, login 200, `/api/auth/me` 200, list/detail GET 200, corrected proxy procedure, logout then me 401. Do not run local test seed against hosted DB.
- [ ] Record deployment identity and actual smoke outcomes. If access/URL/account is missing, record the precise remaining step and keep v1.0 completion/tag pending.

## Execution record

- Planning completed before product edits. User explicitly requested execution, branch/push/PR/CI/merge/redeploy; no repeated design approval is needed.
- Ruling: independent clone instead of reusing an older task's worktree preserves its checkout, dependencies, and local configuration. Native task worktree creation cannot target this projectless task's external repository.
- Baseline evidence: local 29th-session worktree is clean at fa44bfd; hosted deployment was not performed in its task; GitHub has no PRs/deployments and main remains session 4.

- Task 1 complete: baseline build accepted missing env; local page 200/API 500 with ECONNREFUSED; new tests RED (2 failures), minimal guard GREEN (12 config tests); missing-env build now exits 1.
- Task 2 verification complete: format/lint/build pass, API 63 + Web 83 pass, Playwright 1 pass including logout/me 401. Initial restricted API run could not start its child server (48 failures); unchanged elevated rerun passed all 63. No test skips.
- Baseline PR #1 CI quality passed all required stages; independent bounded review found no high-impact blocker; merged with preserved original history at d45fa82.
- Ruling: baseline PR finished before fix PR creation, so fix PR can target main directly, avoiding unnecessary retargeting. Final diff remains only session-30 changes.
- Hosted gate remains open: both dashboards require login, no web/API URL confirmed. No production data modified. No tag or release created.

- Final independent review: no consequential blocker; config tests independently passed 12/12. Accepted wording correction: rewrites validation protects build, while production start reads the existing routes manifest. Adjusted diagnostic/docs, no extra runtime mechanism.

- User scope update: no existing hosted deployment; finish code/PR/CI only. Preserve previously authorized CI-gated merge. Hosted deploy/smoke deferred, not an unresolved login request; no tag/release.
