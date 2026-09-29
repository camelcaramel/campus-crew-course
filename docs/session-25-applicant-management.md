# 25차시 — 작성자의 지원자 목록과 승인·거절

24차시 완료 커밋 `a4df84f`에서 `feat/session-25-applicant-management` 브랜치와 별도 worktree를 만들었다. 기존 4~24차시 이력과 원본 worktree를 보존하며 기존 커밋은 수정하지 않는다.

## 두 관점과 학습 목표

같은 Application을 24차시에서는 지원자가 생성·조회·취소했다. 25차시에서는 모집글 작성자가 목록을 보고 결정을 내린다. 로그인(authentication)과 작성자 권한(authorization)은 다르다. 프론트 버튼 숨김은 UX이고, 실제 접근 통제는 서버가 수행한다.

## API 계약

| Method | 경로                                                | 성공 응답                          |
| ------ | --------------------------------------------------- | ---------------------------------- |
| GET    | `/api/recruitments/:id/applications`                | 200, application 배열, 없으면 `[]` |
| PATCH  | `/api/recruitments/:id/applications/:applicationId` | 200, 변경된 application 객체       |

PATCH body는 `{ "status": "APPROVED" }` 또는 `{ "status": "REJECTED" }`다. `UpdateApplicationStatusDto`의 `@IsIn`과 기존 ValidationPipe가 검증한다. PENDING, 잘못된 문자열, null, 숫자, 배열, 누락은 400이다. 추가 필드는 기존 whitelist 정책에 따라 제거한다.

두 endpoint는 기존 controller의 `JwtAuthGuard`와 `ApplicationSessionGuard`를 사용한다. 권한은 body나 헤더의 임의 userId가 아닌 JWT와 `@CurrentUser()`의 사용자로 결정한다. 선택 `X-Expected-User-Id`는 오래된 화면과 현재 Cookie의 계정 불일치를 감지하는 보조 검사이며 인증 수단이 아니다.

서비스 흐름:

1. recruitmentId 정수 범위 검사 후 모집글 조회. 없으면 404 `RECRUITMENT_NOT_FOUND`.
2. `recruitment.authorId === userId` 확인. 아니면 403 `APPLICATION_FORBIDDEN`.
3. GET은 해당 recruitmentId의 지원만 조회하고 createdAt/id 오름차순으로 반환.
4. PATCH는 applicationId 범위 검사 후 **id와 recruitmentId 둘 다** 조건으로 조회. 없거나 소속이 다르면 404 `APPLICATION_NOT_FOUND`.
5. 현재 상태가 PENDING이 아니면 409 `APPLICATION_INVALID_STATUS`.
6. DB 변경에도 `where: { id, recruitmentId, status: 'PENDING' }`를 적용해 변경된 application을 반환.

선조회만으로 상태 전이를 보호하면 두 요청이 동시에 PENDING을 보고 결정을 덮어쓸 수 있다. 조건부 update는 DB 갱신 순간에도 PENDING을 확인한다. Prisma P2025 발생 시 재조회하여 취소된 행은 404, 이미 결정된 행은 409로 구분한다. 24차시의 조건부 delete와 함께 승인/취소 경합도 보호한다.

| 현재 상태 | 요청 상태              | 결과 |
| --------- | ---------------------- | ---- |
| PENDING   | APPROVED               | 허용 |
| PENDING   | REJECTED               | 허용 |
| APPROVED  | REJECTED 또는 APPROVED | 409  |
| REJECTED  | APPROVED 또는 REJECTED | 409  |

마감된 모집글의 기존 PENDING 지원도 작성자가 결정할 수 있다. 새로운 지원은 기존 24차시 CLOSED 규칙에 따라 차단된다. 자기 모집글 지원 금지 규칙도 유지한다.

## 개인정보 제한

GET의 각 원소와 PATCH 성공 응답은 다음 형태다. 지원자의 모든 User 필드를 include하지 않고 명시적 select를 사용한다. passwordHash, 사용자 타임스탬프, 불필요한 관계는 응답에 없다. private 응답에는 `Cache-Control: no-store`가 붙는다.

```json
{
  "id": 10,
  "message": "함께 참여하고 싶습니다.",
  "status": "APPROVED",
  "createdAt": "2026-09-22T00:00:00.000Z",
  "applicant": { "id": 3, "name": "김학생", "email": "student@example.com" }
}
```

## ApplicationManager와 Query

상세 페이지의 기존 `isOwner`가 참일 때만 `ApplicationManager`를 렌더링한다. 인증 로딩/오류/비로그인/다른 사용자에게는 관리 영역 자체가 없다. 기존 ApplicationSection과 지원자 기능은 유지한다.

- `getApplications(id, signal?, expectedUserId?)`: 작성자 목록 GET.
- `updateApplicationStatus(id, applicationId, status, expectedUserId?)`: status만 전송하는 PATCH.
- `useApplicationsQuery(id, userId)`: 사용자별 목록 캐시, 취소 신호 전달, 조회 오류 처리.
- `useUpdateApplicationStatusMutation(id, userId)`: 승인/거절을 하나의 mutation으로 처리한다.

```ts
applicationsKey(id, userId);
// ['recruitments', String(id), 'applications', userId]
```

계정 전환 때 개인정보가 섞이지 않도록 userId를 포함한다. Manager도 모집글/사용자 key로 재마운트한다. 성공 후 정확한 목록 key의 invalidate/refetch가 끝날 때까지 기다린다. optimistic update는 사용하지 않는다. 403/404/409는 목록을 재조회하고, 401/계정 불일치는 auth/me를 갱신한다.

UI는 loading, error+다시 시도, EmptyState와 간단한 카드 목록이다. 이름/이메일/메시지/상태 배지/날짜를 보여준다. PENDING만 승인·거절 버튼을 표시하고 mutation 중 모두 비활성화한다. 확정 상태는 버튼이 없다. 조회 실패 때는 이전 카드 대신 오류를 표시하여 오래된 상태를 믿고 결정하지 않도록 한다.

지원자 브라우저는 기존 `my-application`을 refetch하거나 새로고침하면 서버의 APPROVED/REJECTED를 받는다. 다른 계정의 캐시를 직접 갱신하거나 실시간 동기화하는 기능은 추가하지 않았다.

## 학생 검증 순서

1. 작성자 로그인 → 자기 모집글 상세의 지원자 관리 영역과 빈 목록 확인.
2. 다른 두 계정으로 24차시 지원 생성 → 작성자로 복귀해 이름·이메일·메시지 확인.
3. Network에서 GET applications 200과 passwordHash 미포함 확인.
4. 첫 지원 승인 → PATCH 200, APPROVED, 결정 버튼 사라짐.
5. 같은 지원에 직접 REJECTED 또는 APPROVED 재요청 → 409.
6. 다른 PENDING 지원 거절 → REJECTED. 다시 APPROVED 요청 → 409.
7. 작성자가 아닌 계정으로 GET/PATCH 직접 호출 → 403.
8. 없는 모집글 → 404 RECRUITMENT_NOT_FOUND. 다른 모집글의 applicationId 혼합 → 404 APPLICATION_NOT_FOUND.
9. PENDING body → 400, 비로그인 → 401.
10. DBeaver에서 `session-25-verify.sql`의 두 ID를 설정하고 상태 변경 확인.
11. 지원자 계정에서 상세 새로고침 → 확정 상태 및 취소 버튼 숨김 확인.

## Postman 실행

`docs/postman/campus-crew-session-25.postman_collection.json`을 가져온다. 전용 검증 DB에서 작성자/지원자1/지원자2로 로그인한 Cookie를 각각 ownerCookie/applicantCookie/secondCookie 환경 변수에 설정한다. recruitmentId는 아직 지원이 없는 작성자 모집글, otherRecruitmentId는 같은 작성자의 다른 모집글이다. baseUrl 기본값은 http://localhost:4000이다.

요청별 Cookie를 명시하고 cookie jar를 비활성화했다. 컬렉션에는 실제 인증 정보가 없다. 컬렉션은 지원 두 건을 생성하고 확정 상태로 만든다. 재실행에는 새 빈 모집글을 사용한다. 기존 지원을 자동 삭제하거나 상태를 되돌리지 않는다.

## 실행 및 실제 검증 기록

검증 환경: 별도 PostgreSQL 17 검증 컨테이너(127.0.0.1:5424), API 4025, web 3025. 기존 수업 DB 초기화나 migration 변경 없이 기존 schema를 사용했다. 원본 설정은 수정하지 않고 새 worktree의 Git 제외 .env를 사용했다.

- baseline: API 기존 43개, 웹 기존 55개 통과. 첫 API 기동에서 24차시 테스트의 시작 대기가 만료되었고 해당 테스트 재실행 13/13 통과.
- RED: 신규 API 14개는 endpoint 부재로, 신규 웹 12개는 함수/컴포넌트 부재로 실패함을 확인한 뒤 구현.
- API 전체: 57/57 통과. 실제 Nest/Prisma/PostgreSQL로 401/403/404/409/400, 응답 allowlist, 승인·거절, 동시 결정 200/409, 취소 경합, 지원자 refetch 검증.
- 웹: 초기 67/67 통과. 독립 리뷰 후 조회 오류와 성공 뒤 refetch 실패 두 테스트 추가.
- Postman/Newman: 22 requests / 41 assertions, 실패 0. 성공·403·404·409·400·401 및 개인정보·지원자 상태 반영 확인.
- 브라우저: owner 빈 목록, 두 지원자 카드, 승인/거절 후 상태·버튼 갱신, 로그아웃 시 관리 영역 숨김, 지원자 로그인 및 새로고침 후 APPROVED 확인.
- 처리 중 UX: 임시 지원 행에 짧은 DB 잠금을 걸어 승인 응답을 지연했다. 네 승인·거절 버튼 비활성화와 처리 중 안내를 실제 브라우저에서 확인한 뒤 잠금 해제 후 정상 승인 확인.
- SQL: 모집글 139의 지원 58/59가 PENDING에서 APPROVED/REJECTED로 변경됨을 직접 조회. Postman 지원 60/61도 APPROVED/REJECTED 확인.
- DBeaver UI: 사용 가능한 앱과 확인한 설치 경로에서 발견되지 않아 미수행. 직접 SQL 검증으로 대체했으며 학생용 읽기 전용 SQL을 제공한다.
- 독립 리뷰: 기능/권한/개인정보/경합 결함 없음. 오류/처리 중 검증 보강 의견을 테스트와 브라우저 확인에 반영.
- 환경 문제: Prisma의 사용자 캐시 쓰기가 제한되어 기존 동일 버전 schema engine을 새 worktree node_modules로 복사하고 명시 경로를 설정했다. 의존성/lockfile은 변경하지 않았다.

기본 실행 명령은 유지한다. API_ORIGIN은 웹 빌드 시 rewrite에 반영된다.

```powershell
npm ci
npm run build --workspace=@campus-crew/api
npm run test:e2e --workspace=@campus-crew/api
npm test --workspace=@campus-crew/web
npm run db:typecheck --workspace=@campus-crew/api
npm run check
```

## 변경 파일

- API: `apps/api/src/modules/applications/applications.controller.ts`, `applications.service.ts`, 새 `update-application-status.dto.ts`.
- API 테스트: `apps/api/test/applicant-management.e2e.mjs`.
- 웹: `apps/web/src/app/recruitments/[id]/page.tsx`, `apps/web/src/features/applications/api.ts`, `types.ts`, `queries.ts`, 새 `application-manager.tsx`.
- 웹 테스트: `apps/web/test/applicant-management.test.mjs`.
- 문서: 이 문서, `session-25-verify.sql`, Postman 컬렉션, 요청한 superpowers 계획 문서.

## 26차시로 연결

이번에는 GET list와 PATCH status를 분리했다. 다음 search/filter/pagination에서는 GET의 query parameter 검증, Prisma where/orderBy/skip/take 또는 cursor, 응답 목록·전체 수, 검색 조건을 포함한 TanStack Query key를 학습한다. 작성자 권한과 응답 필드 제한은 조회가 복잡해져도 유지해야 한다. 이번에는 application pagination, 정원, 승인 취소, 여러 단계 승인, 관리자 role, 알림·이메일을 추가하지 않았다.

## 최종 확인

전체 `npm run check` (format:check/lint/API build/web build), Prisma 타입 검사, API 57/57, 웹 69/69가 모두 종료 코드 0으로 통과했다. 조회 오류와 PATCH 성공 후 목록 refetch 실패에 대한 보강 테스트도 포함한다. 기존 사용자/모집글/지원 전체 snapshot hash가 임시 fixture 정리 전후 일치했다. sequence 값은 테스트 생성으로 증가할 수 있다.

원본 24차시 worktree는 clean이며 HEAD는 `a4df84f`로 유지된다. 4~24차시 21개 커밋, schema/migration/lockfile을 보존했다. 25차시 브랜치는 별도 커밋으로 남기고 merge/push하지 않는다.
