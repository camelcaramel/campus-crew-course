# 24차시 — 모집글 지원, 내 지원 조회, PENDING 취소

23차시 `f9ad5d8`에서 분리한 `feat/session-24-application-apply-cancel-verified` 브랜치다. 4~23차시 코드와 각 worktree를 보존한다. 기존 커밋 수정, 강제 push, reset/clean은 수행하지 않는다.

## 학습 목표와 관계

Application은 User와 Recruitment 사이의 관계를 표현하는 독립 엔티티다. 지원 메시지와 상태, 지원 시각은 사용자나 모집글 자체가 아니라 이 관계에 속한다.

```text
User 1 ── N Application N ── 1 Recruitment
             applicantId       recruitmentId
```

학생이 보내는 데이터는 `{ "message": "함께 참여하고 싶습니다." }`다. `applicantId`는 23차시의 `JwtAuthGuard`와 `@CurrentUser()`를 통해 서버가 정한다. body의 applicantId/status를 위조해도 저장에 사용하지 않는다.

이번 차시의 상태 흐름은 미지원 → PENDING → 취소(행 삭제) → 재지원이다. 다음 차시에는 작성자가 PENDING → APPROVED 또는 REJECTED로 바꾼다. 확정 상태는 조회만 가능하고 취소할 수 없다. 이력이나 soft delete는 추가하지 않는다.

## 백엔드 구조

```text
AppModule
└─ ApplicationsModule
   ├─ imports: PrismaModule, AuthModule
   ├─ ApplicationsController: 경로, Guard, CurrentUser, 응답 코드, Swagger
   ├─ ApplicationsService: 모집 상태/지원 권한/중복/취소 규칙
   └─ CreateApplicationDto: trim, 문자열, 2~200자
```

세 경로 모두 Controller 수준의 `JwtAuthGuard`로 보호하고 `Cache-Control: no-store`를 반환한다. 기존 전역 ValidationPipe를 사용하며 새 전역 필터는 없다.

| Method | 경로                                    | 성공                                                      |
| ------ | --------------------------------------- | --------------------------------------------------------- |
| POST   | `/api/recruitments/:id/applications`    | 201 `{ application }`                                     |
| GET    | `/api/recruitments/:id/my-application`  | 200 `{ application }`, 미지원이면 `{ application: null }` |
| DELETE | `/api/recruitments/:id/applications/me` | 204, 응답 본문 없음                                       |

공개 Application은 `id`, `message`, `status`, `createdAt`만 포함한다.

```json
{
  "application": {
    "id": 1,
    "message": "함께 참여하고 싶습니다.",
    "status": "PENDING",
    "createdAt": "2026-09-20T00:00:00.000Z"
  }
}
```

| 조건                          | 상태 | code                                  |
| ----------------------------- | ---- | ------------------------------------- |
| 미로그인/잘못된 JWT           | 401  | 기존 Guard 응답                       |
| 모집글 없음                   | 404  | RECRUITMENT_NOT_FOUND                 |
| 자기 모집글 지원              | 409  | APPLICATION_SELF_NOT_ALLOWED          |
| CLOSED 모집글 신규 지원       | 409  | RECRUITMENT_CLOSED                    |
| 같은 사용자/모집글 중복       | 409  | APPLICATION_ALREADY_EXISTS            |
| 취소할 본인 지원 없음         | 404  | APPLICATION_NOT_FOUND                 |
| APPROVED/REJECTED 취소        | 409  | APPLICATION_INVALID_STATUS            |
| 메시지 누락/타입/길이 오류    | 400  | 기존 ValidationPipe 응답              |
| 숫자 아닌 id/DB Int 범위 초과 | 400  | ParseIntPipe / INVALID_RECRUITMENT_ID |

비즈니스 예외는 `{ statusCode, code, message }`다. GET은 모집글이 존재하지만 지원만 없을 때 null이며, 모집글도 없으면 404다.

Prisma schema에는 이미 `@@unique([applicantId, recruitmentId])`와 `@default(PENDING)`이 있다. 생성된 client의 실제 이름 `applicantId_recruitmentId`를 확인해 사용했다. schema, migration, 의존성, lockfile 변경은 없다.

서비스의 중복 선검사는 사용자가 이해할 수 있는 오류를 빠르게 반환한다. 하지만 두 요청이 동시에 선검사를 통과할 수 있으므로 DB unique가 최종 일관성을 보장한다. DB의 `P2002`도 같은 409로 변환한다.

취소는 현재 사용자 복합 key로 찾는다. `deleteMany({ where: { id, applicantId: userId, status: 'PENDING' } })`로 삭제 순간에도 상태를 확인한다. 조회 직후 작성자가 승인하더라도 확정된 지원을 삭제하지 않는다. 삭제 수가 0이면 재조회하여 없음(404)과 상태 변경(409)을 구분한다. 모집글이 마감된 뒤에도 기존 PENDING 지원은 조회하고 취소할 수 있다.

## 프론트 구조와 캐시

상세 페이지는 `ApplicationSection`을 추가한다. `/auth/me`의 로딩/오류/비로그인/작성자 여부를 먼저 확인한다. 작성자는 지원 폼을 볼 수 없고, 비로그인은 로그인 링크를 본다. 지원 내역 조회가 실패하면 미지원으로 간주하지 않고 오류와 재시도를 제공한다.

- `ApplicationForm`: React Hook Form + Zod, trim 후 2~200자, textarea, pending 버튼, 검증/서버 오류.
- `ApplicationStatus`: 메시지와 PENDING/APPROVED/REJECTED 표시, PENDING에만 취소 버튼.
- `api.ts`: `createApplication`, `getMyApplication`, `cancelMyApplication`; same-origin Cookie 사용, GET no-store/AbortSignal, DELETE 204 처리.
- `queries.ts`: 내 지원 조회 및 지원/취소 mutation, 성공 후 동일 key invalidate를 기다림.

```ts
myApplicationKey(id, userId);
// ['recruitments', String(id), 'my-application', userId]
```

id는 상세 경로와 동일하게 문자열로 정규화한다. 마지막 userId는 계정 전환 시 다른 사람의 캐시가 보이지 않도록 추가했다. 사용자와 모집글별로 지원 영역을 재마운트하여 이전 입력/오류도 격리한다. 지원 수를 표시하지 않으므로 상세 query는 무효화하지 않는다.

## 실제 검증 결과 — 2026-09-22

2026-09-20의 미커밋 24차시 초안을 새 worktree로 가져와 검토·보완했다. 원본 초안/worktree와 4~23차시 커밋은 수정하지 않았다. 과거 검증 기록은 이번 실행 결과로 사용하지 않았다.

기존 수업 DB와 분리한 PostgreSQL 17 전용 검증 컨테이너의 5424 포트, campus_crew_verify DB에 기존 migration/seed를 적용했다. API 4024, 웹 3024에서 검증했다.

| 항목                         | 결과                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| 23차시 baseline              | API 30/30, 웹 36/36 통과                                                                           |
| 기능 연결 전 RED             | 새 API 12/12, 웹 13/13 실패 확인                                                                   |
| 리뷰 보완 RED→GREEN          | 계정 불일치 API 1개, 오류 후 캐시 갱신 등 웹 6개 실패 재현 후 통과                                 |
| API 전체 e2e                 | 43/43 통과, 실제 Nest/Prisma/PostgreSQL                                                            |
| 웹 전체 테스트               | 55/55 통과                                                                                         |
| Postman/Newman               | 최종 코드에서 30 requests / 47 assertions, 실패 0; 확정 상태 네 요청 포함                          |
| 브라우저                     | 비로그인, OPEN 폼, 1자 검증, 지원→PENDING, 새로고침 유지, 취소→폼, 재지원 확인                     |
| 상태/권한 UI                 | CLOSED 안내, APPROVED/REJECTED 취소 숨김, 작성자 지원 폼 숨김 확인                                 |
| 다른 탭 계정 전환            | 지원자 화면에서 다른 탭의 작성자 로그인 후 오래된 취소 클릭 → 현재 작성자 화면 갱신, 지원 row 보존 |
| DB 직접 조회                 | 모집글 47/지원자 32: PENDING 행 20 생성 → 취소 후 0개 → 재지원 행 21 확인                          |
| 동시 요청                    | 중복 POST 201/409 및 1행; 승인/취소 경합 409 및 승인 행 유지                                       |
| 검증 데이터 보존             | fixture 정리 후 users/recruitments/applications 전체 snapshot hash 일치                            |
| Prisma 타입 검사             | 통과                                                                                               |
| DBeaver UI                   | 앱 목록 및 확인한 설치 위치에서 찾지 못해 미수행. 직접 PostgreSQL 조회와 학생용 SQL 제공           |
| 전체 format:check/lint/build | 모두 통과 (최종 npm run check 종료 코드 0)                                                         |

Postman 데스크톱 대신 공식 실행기 Newman을 사용했다. APPROVED/REJECTED 임시 fixture를 준비하여 선택 폴더의 네 요청도 모두 실행했다. 임시 사용자/모집글/지원 행은 정리했다. sequence는 증가하므로 다음 자동 id는 달라질 수 있다.

초기 환경 오류는 npm 진입 경로, Prisma 캐시 쓰기 권한, 전용 새 DB의 seed/환경설정 누락이었다. 명시적 npm 경로, 기존 Prisma 엔진의 작업공간 복사, 검증 DB seed 및 Git 제외 .env 설정으로 해결했다. 추가 테스트의 fetch 표기 lint 오류도 globalThis.fetch로 수정했다. 원본 코드와 환경은 바꾸지 않았다.

독립 리뷰에서 계정/cookie 불일치와 실패 후 stale cache 문제를 재현하여 수정했다. ApplicationSessionGuard가 선택 X-Expected-User-Id 헤더를 JWT 사용자와 비교하고, 불일치하면 409 AUTH_SESSION_CHANGED를 반환한다. 헤더는 인증 수단이 아니며 applicantId 결정에도 쓰이지 않는다. 기존 세 경로의 JwtAuthGuard/CurrentUser는 그대로 사용한다. 헤더 없는 Postman/API도 현재 JWT 사용자를 기준으로 동작한다.

프론트 query/mutation은 화면 userId를 일치 확인 헤더에 넣는다. AUTH_SESSION_CHANGED/401이면 auth/me를 갱신한다. 지원/취소 404/409이면 내 지원 상태를 재조회하고, RECRUITMENT_CLOSED이면 모집글 상세도 갱신한다. 다른 탭에서 이미 지원/취소하거나 승인한 뒤에도 폼/PENDING에 머물지 않는다.

## 실행과 학생 실습

로컬 `.env`에 DATABASE_URL과 32자 이상 JWT_SECRET을 설정한다. 기존 DB와 seed를 초기화할 필요가 없다.

```powershell
npm ci
npm run build --workspace=@campus-crew/api
npm run test:e2e --workspace=@campus-crew/api
npm test --workspace=@campus-crew/web
npm run db:typecheck --workspace=@campus-crew/api
npm run check
```

기본 개발 포트는 3000/4000을 유지한다. 이전 차시 서버와 충돌하지 않도록 이번 실제 검증에서는 3024/4024를 사용했다. API_ORIGIN은 Next rewrite에 반영되므로 production 실행 전 같은 값으로 빌드한다.

```powershell
# API
$env:PORT='4024'
npm run start:api

# 웹, 별도 터미널
$env:API_ORIGIN='http://localhost:4024'
npm run build --workspace=@campus-crew/web
node node_modules/next/dist/bin/next start apps/web --port 3024

# Postman 컬렉션 실행
npx --yes --package=newman newman run docs/postman/campus-crew-session-24.postman_collection.json
```

컬렉션은 자체 테스트 계정 두 개를 만들고 모집글을 만든 뒤 삭제한다. 계정은 학생이 확인하도록 남긴다. 반복 실행 시 runId를 비운다. `Prepared final statuses` 폴더는 별도 임시 DB fixture의 `fixtureCookie`, `approvedRecruitmentId`, `rejectedRecruitmentId`가 설정된 경우만 실행한다. 이 값이 없으면 네 요청을 건너뛴다. 이번 검증에서는 값을 준비해 **네 요청 모두 실행했다**. 실제 서비스 DB 대상으로 실행하지 않는다.

학생은 작성자/지원자 두 계정으로 다음을 확인한다: 작성자 폼 숨김 → 지원자 로그인 → OPEN 폼 → 1자 오류 → POST 201 → GET PENDING → 직접 중복 POST 409 → DELETE 204 → GET null → 재지원. 이어 CLOSED 지원 409, self 지원 409, 준비된 확정 상태 취소 409를 확인한다. `session-24-verify.sql`을 DBeaver SQL Editor에서 실행하여 실제 행을 비교한다.

## 다음 25차시와 검토 메모

ApplicationsModule에 작성자 전용 applicant 목록과 approve/reject를 확장한다. 작성자인지 서버에서 확인하고 PENDING → APPROVED/REJECTED 전이 조건을 원자적으로 적용한다. 이번 `/me` 경로와 반환 형식은 그대로 재사용할 수 있다.

이번 OPEN 검사는 요청 처리 중 모집글을 조회한 시점 기준이다. 조회 직후 별도 요청이 글을 마감하는 극히 좁은 경합까지 직렬화하지는 않는다. 추가 강화 항목으로, 정확한 마감 시점까지 엄격히 보장하려면 글 마감/지원 트랜잭션의 잠금 정책을 함께 설계해야 한다. 이번에는 제시된 선검사 흐름과 수업 범위를 유지했다. 계정 변경은 지원 요청 시 검출한다. 아무 동작도 하지 않은 탭의 표시를 즉시 바꾸는 실시간 동기화는 추가하지 않았다.

## 변경 파일

- `apps/api/src/app.module.ts`
- `apps/api/src/modules/applications/applications.module.ts`
- `apps/api/src/modules/applications/applications.controller.ts`
- `apps/api/src/modules/applications/applications.service.ts`
- `apps/api/src/modules/applications/create-application.dto.ts`
- `apps/api/src/modules/applications/application-session.guard.ts`
- `apps/api/test/applications.e2e.mjs`
- `apps/web/src/app/recruitments/[id]/page.tsx`
- `apps/web/src/features/applications/api.ts`
- `apps/web/src/features/applications/types.ts`
- `apps/web/src/features/applications/schema.ts`
- `apps/web/src/features/applications/queries.ts`
- `apps/web/src/features/applications/application-section.tsx`
- `apps/web/src/features/applications/application-form.tsx`
- `apps/web/src/features/applications/application-status.tsx`
- `apps/web/test/applications.test.mjs`
- `docs/postman/campus-crew-session-24.postman_collection.json`
- `docs/session-24-verify.sql`
- `docs/session-24-application-apply-cancel.md`
- `docs/superpowers/plans/2026-09-22-campus-crew-session-24-application-apply-cancel.md`
