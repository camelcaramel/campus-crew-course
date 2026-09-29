# Campus Crew Session 25 Applicant Management Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement and verify each task in this session.

**Goal:** 모집글 작성자가 지원자 목록을 조회하고 PENDING 지원을 승인하거나 거절한다.

**Architecture:** 기존 ApplicationsModule과 JwtAuthGuard/CurrentUser를 확장한다. 모집글 존재 → owner → 지원 소속 → PENDING 검사를 수행하고 조건부 Prisma update로 동시 결정도 보호한다. 상세의 owner 영역에 ApplicationManager를 추가하며 기존 지원자 흐름은 보존한다.

**Tech Stack:** NestJS, class-validator, Prisma/PostgreSQL, Next.js, TanStack Query, Node test runner, Postman/Newman.

**Spec:** 현재 사용자의 25차시 구현 요청 전체. 아래 규칙과 제외 범위가 계약이다.

## Global Constraints

- Base a4df84f (24차시 완료). feat/session-25-applicant-management 전용 worktree에서 작업한다.
- 기존 4~24차시 이력/코드와 원본 worktree 보존. reset --hard, clean -fd, push --force, amend 금지.
- GET /api/recruitments/:id/applications → 200 배열; PATCH /api/recruitments/:id/applications/:applicationId → 200 변경된 application.
- 두 경로 모두 기존 controller의 JwtAuthGuard 및 ApplicationSessionGuard 유지.
- recruitment 없음 404 RECRUITMENT_NOT_FOUND, owner 아님 403 APPLICATION_FORBIDDEN, application 소속 불일치/없음 404 APPLICATION_NOT_FOUND.
- UpdateApplicationStatusDto: @IsIn(['APPROVED','REJECTED']); 그 외 status는 400.
- PENDING에서만 APPROVED/REJECTED 전이. 결정된 상태 재요청은 같은 상태를 포함해 409 APPLICATION_INVALID_STATUS.
- 명시적 select로 id/message/status/createdAt 및 applicant {id,name,email}만 반환한다.
- 정원/알림/이메일/admin/상태 되돌리기/pagination/optimistic update 제외. 의존성/schema 변경 불필요.

## Review Focus

1. 동시 승인/거절: WHERE id + recruitmentId + status=PENDING 조건부 update; 정확히 하나만 200, 나머지 409.
2. 지원 취소와 승인 경합: 삭제되면 404, 승인되면 기존 취소가 409. 확정 행을 뒤집거나 삭제하지 않는다.
3. 계정 전환: applications key에 userId 포함, 기대 사용자 헤더 유지, 401/계정 불일치는 auth 갱신.
4. 개인정보: 모든 성공 응답은 select allowlist; passwordHash 및 관계 전체 응답 금지.
5. 조회/변경 실패: error/retry UI, mutation 중 버튼 비활성, 404/409 후 목록 갱신.

## Task 1: Baseline and isolated environment

**Files:** 이 계획, Git 제외 .env. 검증 로그는 현재 task work/에 보관한다.

- [x] 24차시 clean 상태 및 이력 확인, 새 worktree/브랜치 생성.
- [x] 기존 의존성/전용 검증 PostgreSQL 사용 가능 여부 확인, 원본 설정을 변경하지 않고 새 환경 준비.
- [x] API build 및 기존 API/web 테스트 실행. 환경 오류와 기존 실패를 구분 기록.

## Task 2: Owner API with regression tests

**Files:** apps/api/src/modules/applications/{applications.service,applications.controller,update-application-status.dto}.ts; apps/api/test/applicant-management.e2e.mjs.

**Interfaces:** findAll(recruitmentId,userId); updateStatus(recruitmentId,applicationId,userId,body). list는 배열, update는 application 객체.

- [x] 실제 HTTP 테스트를 먼저 추가하고 endpoint 부재 실패를 확인한다. 인증, owner 403, 없음/소속 404, DTO 400, 빈 배열, 개인정보, 승인/거절, 반복 전이 409, 동시 결정 및 취소 경합, my-application 반영을 검사한다.
- [x] service: requireOwner는 requireRecruitment 후 authorId 비교. findMany는 where recruitmentId, select allowlist, createdAt/id 순 정렬.
- [x] PATCH: findFirst({where:{id:applicationId,recruitmentId}}), PENDING 확인, update({where:{id:applicationId,recruitmentId,status:'PENDING'},data:{status},select}). P2025는 재조회로 404/409 구분.
- [x] DTO @IsIn과 Swagger, controller GET/PATCH와 no-store 추가.
- [x] API 전체 e2e 및 Prisma 타입 검사 통과 확인.

## Task 3: ApplicationManager

**Files:** apps/web/src/features/applications/{types,api,queries}.ts; application-manager.tsx; apps/web/src/app/recruitments/[id]/page.tsx; apps/web/test/applicant-management.test.mjs.

**Interfaces:** getApplications(id,signal?,expectedUserId?); updateApplicationStatus(id,applicationId,status,expectedUserId?); useApplicationsQuery(id,userId); useUpdateApplicationStatusMutation(id,userId).

- [x] API payload/오류/사용자 격리, active list refetch, 화면 상태 테스트를 먼저 작성해 실패를 확인한다.
- [x] key ['recruitments',String(id),'applications',userId]. status payload를 받는 하나의 mutation. 성공 시 정확한 key invalidate await; 404/409는 목록 갱신, session 오류는 auth 갱신.
- [x] 상세 isOwner일 때만 Manager 렌더링. 사용자/글별 key로 재마운트.
- [x] loading/error/retry/EmptyState와 간단한 카드. name/email/message/status/date 표시. PENDING에서만 승인/거절 버튼, pending 동안 중복 클릭 방지.
- [x] 웹 전체 테스트, 실제 브라우저 owner/비owner/빈 목록/승인/거절 확인.

## Task 4: Integration evidence and final commit

**Files:** docs/postman/campus-crew-session-25.postman_collection.json; docs/session-25-verify.sql; docs/session-25-applicant-management.md.

- [x] Postman 컬렉션 작성 및 Newman 실행: 성공/401/403/404/409/400, 개인정보, 지원자 refetch.
- [x] DBeaver 사용 가능 여부 확인. 불가하면 직접 PostgreSQL SELECT 검증과 미실행 사실을 명시한다.
- [x] npm run format:check, npm run lint, npm run build, API/web tests 검증. fixture만 정리하여 기존 DB 행 보존 확인.
- [x] 독립 최종 리뷰 및 중요한 문제 수정/회귀검증.
- [x] 결과/변경 파일/26차시 연결 설명 기록, git diff --check, 원본 상태 확인.
- [x] feat: add applicant management 별도 커밋, push/merge 없이 보존.

## Execution ledger

- 사용자 요청에 이미 구체적 설계와 계획 후 실행 지시가 있어 재승인 단계 없이 진행한다.
- 현재 task는 projectless여서 native worktree 도구가 대상 저장소를 지정할 수 없다. 발견한 24차시 저장소에서 git worktree add를 사용했다.
- 최종 한 커밋에 구현/테스트/문서를 포함하여 차시별 이력을 유지한다.

- Task 1: worktree/branch 생성, 의존성 offline 설치. Prisma 사용자 캐시 권한 문제를 동일 버전 엔진 복사/명시 경로로 해결. baseline API 30/30 + 시작 지연 후 applications 재실행 13/13, web 55/55.
- Task 2: 신규 API 14개 endpoint 부재 RED 확인 후 구현. 전체 API 57/57 GREEN. 명시적 select 및 조건부 update의 동시 결정/취소 경합 검증.
- Task 3: 신규 웹 12개 RED 확인 후 API/hooks/Manager 연결, 웹 전체 67/67 GREEN. owner만 렌더링, 사용자 key 및 expected-user guard 유지.
- Task 4: Newman 22 requests / 41 assertions 실패 0. 브라우저 owner empty/cards/approve/reject/disabled pending/non-owner hidden/applicant APPROVED refetch 확인. SQL 58/59 APPROVED/REJECTED 확인.
- Review: 독립 reviewer 기능/보안 결함 없음. 정적 오류 UI와 PATCH 후 refetch 실패 테스트 추가, focused web 14/14 GREEN. pending 버튼은 실제 DB 지연과 브라우저로 검증.
- Ruling: 작성자 목록은 userId를 key에 포함하여 계정별 개인정보 캐시를 격리. 기존 24차시 정책과 일치.
- Ruling: CLOSED는 신규 지원만 제한, 기존 지원 관리 허용. 25차시 목표의 PENDING 전이 규칙 유지.
- Ruling: DBeaver 앱 미발견으로 UI 검증 불가. 직접 PostgreSQL 조회 및 읽기 전용 학생 SQL을 제공하고 미실행 사실 명시.

- Final verification: npm run check 종료 코드 0 (format:check/lint/API+web build 모두 통과), Prisma 타입 검사 0, API 57/57, web 69/69.
- Final preservation: 임시 사용자/모집글/지원 fixture 정리 후 기존 세 테이블 snapshot hash 일치. 원본 24차시 worktree clean, HEAD a4df84f 유지. schema/migrations/lockfile 변경 없음.
- Finalization: 사용자 요청대로 feat: add applicant management 별도 커밋에 구현/테스트/문서 포함. 브랜치와 worktree 보존, merge/push 없음.
