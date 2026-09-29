# Campus Crew Session 22 Login JWT Cookie Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. The user has explicitly requested writing this plan and proceeding with implementation.

**Goal:** 기존 회원가입 사용자가 로그인하고 HttpOnly JWT cookie로 me를 확인한 뒤 로그아웃한다.

**Architecture:** 21차시 AuthModule/AuthService/AuthController를 확장한다. main의 기존 env 로딩 이후 JwtModule.registerAsync factory가 secret을 읽고, AuthService가 bcryptjs.compare 및 JWT 서명/검증과 공개 user 조회를 담당한다. 브라우저는 기존 Next rewrite를 통한 same-origin /api만 사용한다.

**Tech Stack:** 기존 Nest 11.2.3, Prisma 7.10.0, bcryptjs 3.0.3, Next 16.3.4, React 19.3.0, TanStack Query 5, RHF 7, Zod 4 유지. Nest 11 호환 @nestjs/jwt와 cookie-parser 및 Express 타입만 추가한다.

**Spec:** 이 작업의 사용자 요청에 명시된 22차시 요구사항. 별도 승인 단계 없이 계획 작성 후 실행하도록 지시됨.

## Global Constraints

- 기준 commit dfb5e28(21차시), 새 worktree outputs/campus-crew-session-22, branch feat/session-22-login-jwt-cookie. 4~21차시 worktree 및 커밋 보존.
- 파괴적 git 명령 및 기존 commit 수정 금지. 마지막 새 commit: feat: add jwt cookie login.
- access_token: httpOnly true, sameSite lax, path /, secure NODE_ENV === production, JWT/cookie 수명 1시간.
- JWT_SECRET은 env 필수. 실제 비밀은 ignored .env, example에는 placeholder만. payload sub/email 및 표준 iat/exp만.
- login/me: { user: { id, name, email } }, logout: 200 { message }. token/hash는 JSON에 넣지 않는다.
- Refresh/OAuth/role/owner authz/모집글 Guard/remember me/localStorage/복잡한 CSRF는 제외.
- 현재 저장소에는 /login 구현이 없고 Figma URL도 없다. 기존 스타일 토큰과 공통 레이아웃으로 F01 목적의 최소 로그인 화면을 추가하며 Figma 원본 일치라고 주장하지 않는다.

## Review Focus

1. 없는 이메일과 틀린 비밀번호는 같은 401 메시지, password/hash 노출 없음.
2. 만료/위조/잘못된 payload/삭제된 사용자 token은 401; DB 장애를 401로 숨기지 않음.
3. production Secure 및 동일한 path/options로 logout cookie 제거.
4. Next proxy Set-Cookie/Cookie 전달, 새로고침 후 인증 유지, 캐시 역전 방지.
5. 기존 signup의 bcrypt 72바이트/Unicode 제한 및 모집글 CRUD 회귀 보존.

## Task 1: Backend authentication contract

**Files:** apps/api/src/modules/auth/{auth.service,auth.controller,auth.module,login.dto,auth-response.dto,auth-cookie,auth-config}.ts; apps/api/src/main.ts; apps/api/.env.example; apps/api/package.json; package-lock.json; apps/api/test/auth.e2e.mjs.

**Interfaces:** login(LoginDto) -> { user, token } internally; authenticate(token: unknown) -> public user. Controller serializes only { user }. Export AuthService for session 23.

- [x] Install only compatible exact package versions; copy existing local DB configuration without logging secrets. Baseline API build/e2e and web tests.
- [x] Write real HTTP/DB tests first for login 200/401/400, safe response, cookie flags, me absence/tampering/expiration/payload/deleted user, logout, production Secure. Run against baseline build; expect missing routes (404).
- [x] Implement LoginDto using PickType(SignupDto, ['email', 'password']) to retain password validation. bcryptjs compare against stored hash, same Unauthorized response on unknown/wrong credentials.
- [x] Configure JWT with required env and HS256/3600 seconds. Use signAsync({ sub: user.id, email: user.email }); authenticate verifies signature/expiry then safe integer PostgreSQL id and email payload, then DB select id/name/email.
- [x] Add cookie-parser, no-store response headers, login/me/logout Swagger, 200 logout with clearCookie same options excluding maxAge.
- [x] Build and run complete API e2e suite; expect existing and new tests all green and preexisting DB rows unchanged.

## Task 2: Frontend login and session UI

**Files:** apps/web/src/features/auth/{api,queries,schema,login-form}.ts(x); apps/web/src/app/login/page.tsx; apps/web/src/components/layout/header.tsx; apps/web/test/auth.test.mjs.

**Interfaces:** login(values) -> AuthResponse; getMe() -> AuthResponse|null (401 only); logout() -> void; authMeKey=['auth','me']; useMeQuery().

- [x] Write frontend boundary tests for me 401 vs server error, same-origin endpoints, credential message, schema; observe missing feature failure before implementation.
- [x] Add RHF/Zod email and 8~50 password validation, accessible labels/errors, pending button and useMutation.
- [x] On successful login cancel in-flight auth query and set public user cache, then router.push('/recruitments'). On logout cancel query and set null; queryFn forwards AbortSignal.
- [x] Connect Header to useMeQuery; display user name/logout, login link, and recoverable session error state. Keep signup UI outside scope.
- [x] Run web tests, lint and build; browser form wrong-password error, correct redirect, reload and Header logout.

## Task 3: Verification, teaching checkpoint, review and commit

**Files:** docs/session-22-login-jwt-cookie.md; README.md; this plan.

- [x] Run full format:check/lint/build, API e2e and web tests, DB typecheck. Record actual outcomes.
- [x] Check browser network through localhost:3000 proxy, HttpOnly visibility, cookie flags and reload/logout; production Secure through real HTTP response test.
- [x] Document student steps, hash vs compare, signed visible payload, cookie vs verified authentication, SameSite/Secure, me/logout and session 23 Guard/owner extension.
- [x] Independent final review, address material findings, verify diff and baseline preservation, commit feat: add jwt cookie login.

## Official references checked on 2026-09-19

- https://docs.nestjs.com/security/authentication
- https://github.com/nestjs/jwt (registerAsync/signAsync/verifyAsync)
- https://github.com/expressjs/cookie-parser
- https://expressjs.com/en/5x/api.html#res.clearCookie
- https://github.com/dcodeIO/bcrypt.js

## Execution record

- Baseline API 19/19, web 20/20. Initial dependency setup finished before valid baseline run; no source change was needed for setup.
- Task 1 complete: real HTTP/DB auth tests RED (404) then GREEN. Final API suite 27/27.
- Task 2 complete: auth boundary/schema tests RED then GREEN. Final web suite 25/25. Browser wrong-password/success/redirect/reload/logout verified.
- Ruling: existing servers occupy 3000/4000, so verified 3022/4022 using optional server-only API_ORIGIN; default proxy remains 4000. Cost: override needs dev restart or rebuild.
- Final independent review found signup-compatible email validation mismatch and Swagger cookie scheme mismatch. Both reproduced with failing tests and fixed; full suites green. Swagger finding treated as a functional documentation defect and included in the fix pass.
- Review scope ruling: Guards/owner authorization and advanced production hardening remain outside session 22 as instructed; this checkpoint is not a complete production auth deployment.
- No deferred minor findings. Final docs list validation limits. Separate feature commit is the last step.
