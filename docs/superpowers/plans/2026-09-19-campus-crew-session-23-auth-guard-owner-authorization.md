# Campus Crew Session 23 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Track evidence here.

**Goal:** Preserve sessions 4–22 while protecting recruitment mutations with JWT Cookie authentication and owner authorization.

**Architecture:** Reuse `AuthService.authenticate()` in `JwtAuthGuard`, attach the safe database user to the request, and expose it through `@CurrentUser()`. Apply the same Guard to `/auth/me` and the three recruitment mutations. Keep ownership checks in the recruitment service and reuse the existing auth query for UI visibility.

**Tech Stack:** Existing NestJS, Prisma/PostgreSQL, Next.js, TanStack Query, Node test runner; no new product dependency.

**Spec:** The user's September 19 session-23 request in this task is authoritative, including its 13 verification scenarios and exclusions.

## Global Constraints

- Start from session 22 commit `34c388a`, on `feat/session-23-auth-guard-owner-authorization` in a separate worktree.
- Preserve existing checkpoints and data. Never reset, clean, force-push, amend, merge, or push.
- Keep Cookie name `access_token`; use `request.cookies` and verified JWT, not decode.
- No `any`, passwordHash in request identity, roles, refresh tokens, applications, advanced CSRF or routing framework.
- AuthUser contains only `id: number`, `name: string`, `email: string`.
- Missing/invalid authentication = 401; existing non-owned recruitment = 403; missing recruitment for authenticated user = 404.
- Keep GET list/detail public; retain existing CRUD persistence and UI states.

## Review Focus

- Expired, malformed, forged, or deleted-user tokens cannot mutate data.
- A forged body authorId cannot impersonate another user or change ownership.
- A logged-out or switched-account UI cannot retain owner controls, including delete confirmation.
- Failed auth lookup is distinct from logged-out and fails closed for mutation UI.
- Existing records, seeds, and previous worktrees remain unchanged after tests.

## Task 1: Shared identity and server authorization

**Files:** Add `apps/api/src/common/types/auth-user.ts`, `common/guards/jwt-auth.guard.ts`, `common/decorators/current-user.decorator.ts`; update auth service/controller/module and recruitment DTO/controller/module/service; update `apps/api/test/recruitments.e2e.mjs` and add focused authorization tests as needed.

**Interfaces:** `authenticate(token: unknown): Promise<AuthUser>`; request user is optional before Guard; `create(userId, body)`, `update(id, userId, body)`, `remove(id, userId)` receive identity only from the server.

- [x] Run existing API and web baseline tests after dependency setup and API build.
- [x] Extend real HTTP/DB tests with signed test identities and 401/403/404, spoofed authorId, safe identity and no-write assertions. Observe failure before implementation.

```js
assert.equal(
  (await request('POST', '/api/recruitments', body, '')).status,
  401,
);
assert.equal(
  (await request('PATCH', `/api/recruitments/${row.id}`, {}, otherCookie))
    .status,
  403,
);
assert.equal(
  (await request('DELETE', '/api/recruitments/-1', undefined, ownerCookie))
    .status,
  404,
);
assert.equal(created.authorId, owner.id);
```

- [x] Implement the shared Guard and decorator, export providers through AuthModule, import AuthModule in RecruitmentsModule.

```ts
const request = context.switchToHttp().getRequest<AuthRequest>();
const cookies = request.cookies as Record<string, unknown> | undefined;
request.user = await this.authService.authenticate(cookies?.[AUTH_COOKIE_NAME]);
return true;
```

- [x] Remove authorId from Create DTO; explicitly select editable fields and set `authorId: userId` last. Load recruitment before PATCH/DELETE and reject non-owner with `ForbiddenException` (`RECRUITMENT_FORBIDDEN`). Preserve existing missing-resource/range handling.
- [x] Rebuild API, run full API tests and verify no passwordHash reaches requests/responses; Swagger documents protected routes.

## Task 2: Auth-aware forms and owner UI

**Files:** recruitment API/types/create form, detail/edit pages, existing web request and rendered-state tests.

**Interfaces:** Existing `useMeQuery()` returns `{ user: { id, name, email } } | null`; create request has title/content/category only. Mutation error messages distinguish 401 and 403.

- [x] Change request tests to assert exact body keys and add 401/403 error tests. Add rendered-state coverage for owner/non-owner/logged-out/auth-error. Observe RED.
- [x] Remove DEMO_AUTHOR_ID and authorId from request type/payload; explicitly construct body from three fields.
- [x] Use existing auth query; render owner actions only when auth is successful and `me.data?.user.id === recruitment.author.id`. Gate delete confirmation as well.
- [x] Show loading/auth error/login link on create/edit as applicable; non-owner edit gets an explanation. Keep mutation errors visible.
- [x] Run web suite and full format/lint/build.

## Task 3: Integration verification and handoff

**Files:** `docs/postman/campus-crew-session-23.postman_collection.json`, `docs/session-23-auth-guard-owner-authorization.md`, README and this execution record.

- [x] Start isolated API/web ports 4023/3023 with the existing local database (no reset/reseed).
- [x] Build and run a Postman collection for signup/login, anonymous/invalid 401, owner create/patch/delete, other-user 403, absent 404, identity equivalence and authorId spoofing. Record the actual runner used.
- [x] Use browser UI for logged-out new page, owner create/detail/edit, logout, second-user hidden controls, and error UX where practical.
- [x] Review the complete diff using a fresh reviewer while documentation is prepared. Fix important findings with regression evidence.
- [x] Record actual results/limitations and learning points (Authentication vs Authorization; UI vs server enforcement; session 24 Application identity reuse).
- [x] Verify original worktree is clean and base remains an ancestor. Commit all session-23 changes as `feat: protect recruitment mutations with auth` without changing existing commits.

## Execution record

- Plan written before product changes. User explicitly asked to write the plan then execute; continuing directly using native execution.
- Ruling: create a sibling worktree under this task's outputs, preserving the session-22 worktree as a checkpoint. All source history starts at 34c388a.
- Ruling: retain user-authorized direct implementation and one final commit; planning approval prompts and per-task commits are superseded by this request.
- Pre-flight: Task 2 consumes the safe user identity from Task 1 via unchanged `/auth/me` response shape. Task 3 consumes both tasks through real HTTP and browser interaction.

### Completed evidence

- Task 1: complete. Baseline API 27/27 and web 25/25. Unauthorized POST failed RED with 201 instead of 401; non-owner PATCH failed RED with 200 instead of 403. Final API suite 30/30 passed against real PostgreSQL with before/after preservation snapshots.
- Task 2: complete. Payload, error-message and UI tests failed RED before changes. Final web suite 36/36. Full API/web build, lint, format and Prisma typecheck passed.
- Task 3: complete. Newman ran the Postman collection: 22 requests, 34 assertions, zero failures. Real browser verified owner CRUD, refresh, non-owner hiding/direct edit denial, logout with delete confirmation open and deleted-resource 404. Test recruitment 112 and exactly four generated integration users were removed; existing data untouched.
- Ruling: use ports 3023/4023 and the existing API_ORIGIN override to preserve previous lesson servers. Cost: changing the proxy origin requires a web restart/rebuild.
- Ruling: Postman UI is unavailable on the enabled browser-only surface; execute the actual collection with Newman. Cost: no desktop Postman screenshots. Browser DevTools Network panel is also unavailable; assert exact request keys through HTTP tests/Postman rather than claim a browser Network capture.
- Debugging: explicit Swagger success response decorators restored 201/200/204 after adding error response decorators. Test transpilation now matches the web project's ES2017 target so Error subclass behavior matches production.
- Final independent review: no Critical/Important issues. Its minor automated-transition coverage gap was verified manually: opening delete confirmation then logging out removes confirmation and owner controls. Automated transition coverage remains a minor future test improvement.
- Final review rulings: coordinating agent verified DB snapshots, prior-worktree cleanliness, browser transitions and all build/lint checks. Roles/refresh/applications/advanced CSRF remain intentionally excluded; this does not claim those features are implemented.
- Keep this branch/worktree as the deliverable and create the single user-requested feature commit; do not merge or push.
