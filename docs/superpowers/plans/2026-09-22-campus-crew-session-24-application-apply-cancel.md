# Campus Crew Session 24 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to execute and verify each task. Preserve the original worktrees.

**Goal:** 로그인 사용자의 지원 생성, 내 지원 조회, PENDING 지원 취소를 구현하고 실제 동작을 검증한다.

**Architecture:** 23차시 AuthModule/JwtAuthGuard/CurrentUser 및 PrismaModule을 재사용하는 ApplicationsModule. 기존 상세 화면에 ApplicationSection을 연결하고 사용자별 TanStack Query 캐시로 상태를 결정한다.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Next.js/React, TanStack Query, React Hook Form, Zod, Node test runner, Postman/Newman.

**Spec:** 이 작업의 사용자 요청 전체. 아래 API, 규칙, 제외 범위가 구현 계약이다.

## Global Constraints

- Base: session 23 commit `f9ad5d8`; new branch `feat/session-24-application-apply-cancel-verified`.
- 기존 4~23차시와 2026-09-20의 미커밋 24차시 초안은 수정하지 않는다. 초안은 새 worktree로 복사하여 검토한다.
- 파괴적 Git 명령, 기존 commit 수정, DB 초기화, 기존 데이터 삭제 금지.
- Body는 `{ message: string }`, trim 후 2~200자. applicantId는 CurrentUser, status는 DB PENDING 기본값.
- 세 경로 모두 JwtAuthGuard. POST applications 201, GET my-application 200 `{ application: null | {id,message,status,createdAt} }`, DELETE applications/me 204.
- 없는 모집글 404 RECRUITMENT_NOT_FOUND; 자기 지원 409 APPLICATION_SELF_NOT_ALLOWED; 마감 409 RECRUITMENT_CLOSED; 중복 409 APPLICATION_ALREADY_EXISTS; 없는 본인 지원 404 APPLICATION_NOT_FOUND; 확정 상태 취소 409 APPLICATION_INVALID_STATUS.
- Prisma의 기존 `@@unique([applicantId, recruitmentId])` 및 생성 API `applicantId_recruitmentId`를 확인한다. service 선검사와 P2002 처리를 함께 사용한다.
- 작성자 목록, 승인/거절 API, 정원, 알림, pagination, history/soft delete는 제외한다.
- 원본 초안 문서의 과거 검증 주장은 이번 검증 결과로 간주하지 않는다.

## Review Focus

1. 계정 전환: userId별 query key와 컴포넌트 key로 타인 상태/입력을 격리한다. 웹 테스트 및 브라우저로 확인.
2. 동시 중복: 실제 POST 두 개의 결과가 201/409이고 DB row가 하나인지 확인.
3. 승인과 취소 경합: 삭제 조건에 PENDING을 넣어 조회 이후 확정된 행을 보존한다. 실제 DB interleaving 테스트.
4. 잘못된 입력/조회 실패: 길이, 타입, id, 401, 비 JSON 오류를 검증하고 조회 오류를 미지원으로 표시하지 않는다.
5. CLOSED 이후 기존 지원: 신규 지원만 막고 기존 지원 조회와 PENDING 취소는 허용한다.

## Task 1: Baseline and isolated verification environment

**Files:** `.env` (ignored), plan, existing API/web tests.

- [x] 원본 Git 상태와 커밋 확인, 별도 worktree 생성.
- [x] 의존성과 PostgreSQL 실행 환경 확인. 가능하면 전용 검증 DB를 사용한다.
- [x] 23차시 web/API baseline 실행. 실패는 기능 실패와 환경 실패를 구분하여 기록한다.
- [x] 초안의 테스트를 먼저 복사하고 기능 부재로 실패함을 확인한다.

## Task 2: Applications API

**Files:** `apps/api/src/app.module.ts`, `apps/api/src/modules/applications/{applications.module,applications.controller,applications.service,create-application.dto}.ts`, `apps/api/test/applications.e2e.mjs`.

**Interfaces:** `create(recruitmentId,userId,body)`, `findMine(recruitmentId,userId)`, `cancelMine(recruitmentId,userId)`.

- [x] 초안 API를 검토 후 복사한다. guard/current user/DTO/schema API를 실제 코드와 대조한다.
- [x] 생성은 `application.create({data:{message:body.message,applicantId:userId,recruitmentId}})`; 조회는 복합 unique; 취소는 `deleteMany({where:{id,applicantId:userId,status:'PENDING'}})`.
- [x] API build 후 `npm run test:e2e --workspace=@campus-crew/api` 실행. 인증, self/closed/duplicate/status, null, 204, 재지원, 경쟁조건, DB 생성/삭제를 검증한다.

## Task 3: Applicant UI

**Files:** `apps/web/src/app/recruitments/[id]/page.tsx`, `apps/web/src/features/applications/{api,types,schema,queries}.ts`, `{application-section,application-form,application-status}.tsx`, `apps/web/test/applications.test.mjs`.

**Interfaces:** `createApplication(id,{message})`, `getMyApplication(id,signal?)`, `cancelMyApplication(id)`; query key `['recruitments',String(id),'my-application',userId]`.

- [x] 초안 UI를 검토 후 복사하고 기존 auth/me 및 상세 query를 유지한다.
- [x] 지원/취소 성공 때 동일 key invalidate를 await한다. PENDING에만 취소 버튼. 비로그인 로그인 안내, 작성자 폼 숨김, CLOSED 신규 폼 숨김.
- [x] `npm test --workspace=@campus-crew/web` 실행. 브라우저에서 1자 검증 → 지원 → PENDING → 새로고침 → 취소 → 폼 → 재지원 및 작성자 UI 확인.

## Task 4: Integration evidence and commit

**Files:** `docs/postman/campus-crew-session-24.postman_collection.json`, `docs/session-24-verify.sql`, `docs/session-24-application-apply-cancel.md`.

- [x] Postman 컬렉션을 Newman 또는 사용 가능한 Postman UI로 실행. APPROVED/REJECTED fixture를 준비하여 선택 테스트도 실행한다.
- [x] DBeaver UI 가능 여부 확인. 불가하면 직접 SQL 검증과 미실행 사실을 명시한다.
- [x] `npm run db:typecheck --workspace=@campus-crew/api`, 전체 `npm run check` 실행.
- [x] 독립 최종 코드 리뷰 후 중요한 결함은 재현 테스트와 함께 수정한다.
- [x] 변경 파일, 실제 검증, 제한 사항, 25차시 연결을 문서에 기록한다.
- [x] `git diff --check` 및 원본 보존 확인 후 `feat: add recruitment application flow` 커밋. push/merge 없이 브랜치를 보존한다.

## Execution record

- 2026-09-22: 원본 초안 발견. 현재 작업은 source worktree를 변경하지 않고 새 worktree에서 검증 및 완성한다.

- Task 1: baseline API 30/30, web 36/36. 전용 PostgreSQL 17 DB 준비. API 12/12 및 웹 13/13 RED 확인.
- Task 2: 실제 Prisma 복합 unique 확인. 세 경로 및 조건부 취소 구현. 계정 불일치 guard 회귀검사 RED→GREEN, 전체 API 43/43.
- Task 3: UI와 API/queries 연결. 계정 일치 헤더/오류 상태 재조회 회귀검사 6개 RED→GREEN, 웹 전체 55/55.
- Task 4: 브라우저 apply/cancel/reapply 및 작성자/마감/확정 상태, 다른 탭 계정 전환 확인. Newman 30요청/47검증 통과. SQL 생성/삭제 확인. fixture 정리 후 snapshot hash 일치.
- Review: 독립 리뷰의 계정/cookie 불일치 및 오류 후 오래된 상태 문제를 재현하고 수정했다.
- Ruling: 조건부 deleteMany 사용 — 승인/취소 경합 보존 — 비용: 조건부 삭제 설명 추가.
- Ruling: userId query key와 선택 X-Expected-User-Id 일치 검사 — 다른 탭 cookie 변경 보호 — 비용: 선택 헤더/guard 설명 추가. applicantId는 JWT 사용자만 사용.
- Ruling: 조회 시점 OPEN 선검사 유지 — 요청된 수업 흐름 — 한계: 동시 마감과 지원을 직렬화하지 않음.
- DBeaver UI는 앱 미발견으로 미수행; 직접 PostgreSQL 조회 및 학생용 SQL 제공. Postman은 Newman으로 실행.

- Final verification: 전체 npm run check 종료 코드 0; API 43/43, 웹 55/55, Prisma 타입 검사 통과. 기존 auth/schema/lockfile 변경 없음. 변경 내용을 feat: add recruitment application flow로 새 커밋하고 worktree/브랜치 보존.
