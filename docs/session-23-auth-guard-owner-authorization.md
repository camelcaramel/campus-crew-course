# 23차시 — JWT Guard와 모집글 작성자 권한

22차시의 `34c388a`를 기준으로 별도 worktree와 `feat/session-23-auth-guard-owner-authorization` 브랜치에서 구현했습니다. 4~22차시 커밋과 이전 worktree는 그대로 보존합니다. 기존 커밋 수정, reset, clean, force push, DB 초기화/재시드는 하지 않았습니다.

## Authentication과 Authorization

- **Authentication(인증): 누구인가?** Cookie JWT 서명·만료를 검증하고 DB에서 현재 사용자를 찾습니다.
- **Authorization(인가): 무엇을 할 수 있는가?** 해당 사용자가 이 모집글의 작성자인지 확인합니다.
- **Guard:** Controller 실행 전에 공통 인증 검사를 수행합니다. 각 endpoint에 Cookie/JWT 검증을 복사하지 않습니다.
- 프론트 버튼 숨김은 사용자 경험입니다. Postman 등에서 직접 호출하는 요청을 막는 보안 경계는 서버 Guard와 service의 owner check입니다.

## Guard → CurrentUser → Service

```text
request.cookies.access_token
  → JwtAuthGuard
  → AuthService.authenticate(token)
  → HS256 JWT 검증 + sub/email/exp 형식 검증
  → sub로 DB User 조회 (id/name/email만 select)
  → request.user = AuthUser
  → @CurrentUser()
  → Controller가 user.id를 Service로 전달
```

```ts
type AuthUser = { id: number; name: string; email: string };
```

`passwordHash`와 JWT 원문은 request.user 및 응답에 넣지 않습니다. `GET /api/auth/me`도 같은 Guard와 decorator를 사용하여 모집글 API와 정확히 같은 DB identity를 사용합니다. 기존 Cookie 이름 `access_token`, HttpOnly/SameSite/production Secure 정책은 유지합니다. AuthModule은 Guard와 AuthService를 내보내며 RecruitmentsModule이 이를 가져옵니다.

## API 규칙

| 요청                           | 인증        | 작성자 조건                    | 성공           |
| ------------------------------ | ----------- | ------------------------------ | -------------- |
| GET 목록/상세                  | 없어도 가능 | 없음                           | 200            |
| POST `/api/recruitments`       | 필수        | 현재 사용자를 작성자로 저장    | 201            |
| PATCH `/api/recruitments/:id`  | 필수        | 기존 글의 authorId === user.id | 200            |
| DELETE `/api/recruitments/:id` | 필수        | 기존 글의 authorId === user.id | 204, 본문 없음 |

PATCH/DELETE는 먼저 글을 조회합니다. 없으면 404, 있으면 작성자를 비교하여 다를 때 403을 반환하고, 일치할 때만 update/delete를 호출합니다. 작성자 변경을 받는 API는 추가하지 않았습니다. 조회 직후 글이 삭제된 경우의 기존 Prisma P2025 → 404 처리도 유지합니다.

| 상태             | 의미                                                                             |
| ---------------- | -------------------------------------------------------------------------------- |
| 401 Unauthorized | Cookie 없음, 서명 오류, 만료, 유효하지 않은 identity, 삭제된 사용자 등 인증 실패 |
| 403 Forbidden    | 로그인했지만 다른 사람의 글 수정/삭제; `code: RECRUITMENT_FORBIDDEN`             |
| 404 Not Found    | 인증된 사용자가 요청한 모집글이 없음                                             |

인증은 Controller 실행 전이므로 **로그아웃 상태에서 없는 id를 PATCH/DELETE해도 401**입니다. 공개 GET의 없는 글은 로그인 여부와 관계없이 404입니다. 기존 숫자 id 파싱/DB 정수 범위의 400 처리도 유지합니다.

## authorId를 제거한 위치

1. API `CreateRecruitmentDto`에서 필드와 Swagger 속성을 제거했습니다.
2. 웹 `CreateRecruitmentRequest`는 title/content/category만 가집니다.
3. 웹 `DEMO_AUTHOR_ID`를 삭제했습니다.
4. `createRecruitment()`가 세 필드만 명시적으로 골라 POST합니다. 런타임에 추가 속성을 전달해도 작성자 id를 보내지 않습니다.
5. 서버는 허용된 입력 필드를 골라 `authorId: userId`로 저장합니다. global whitelist와 별개로 service에서도 클라이언트 작성자 값을 사용하지 않습니다.

다른 사용자의 authorId를 보내서 글을 대신 작성하거나 PATCH에서 작성자를 바꿀 수 없습니다. Recruitment **응답**의 authorId와 DB 관계 필드는 정상적인 조회 정보이므로 유지합니다.

## 프론트 규칙

기존 `useMeQuery()`와 `['auth', 'me']`를 재사용합니다.

- 상세: 인증 조회가 loading/error가 아니고 `me.data?.user.id === recruitment.author.id`일 때만 수정·삭제 버튼과 삭제 확인창을 표시합니다.
- 비로그인 작성/수정 접근: 로그인 안내 링크를 보여줍니다.
- 비작성자 수정 주소 직접 접근: “작성자만 수정할 수 있습니다.”를 보여줍니다.
- 인증 조회 실패: 이전 캐시에 작성자 정보가 있어도 편집 UI를 닫고 재시도 안내를 보여줍니다.
- mutation 401: “로그인이 필요합니다. 다시 로그인해주세요.”
- mutation 403: “작성자만 수정하거나 삭제할 수 있습니다.”
- 기존 pending, 입력 검증, 오류 표시, 삭제 확인, 목록/상세 캐시 갱신은 유지합니다.

## 변경 파일

| 구분           | 파일                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 공통 인증 추가 | `apps/api/src/common/guards/jwt-auth.guard.ts`, `common/decorators/current-user.decorator.ts`, `common/types/auth-user.ts`                        |
| 인증 재사용    | `apps/api/src/modules/auth/auth.service.ts`, `auth.controller.ts`, `auth.module.ts`                                                               |
| 모집글 권한    | `apps/api/src/modules/recruitments/create-recruitment.dto.ts`, `recruitments.controller.ts`, `recruitments.service.ts`, `recruitments.module.ts`  |
| 웹 입력/오류   | `apps/web/src/features/recruitments/types.ts`, `api.ts`, `create-recruitment-form.tsx`                                                            |
| 웹 화면        | `apps/web/src/app/recruitments/[id]/page.tsx`, `[id]/edit/page.tsx`                                                                               |
| 회귀 테스트    | `apps/api/test/recruitments.e2e.mjs`; `apps/web/test/create-recruitment.test.mjs`, `edit-delete-recruitment.test.mjs`, `edit-form-state.test.mjs` |
| 수업/검증      | 이 문서, README, 요청한 계획 문서, `docs/postman/campus-crew-session-23.postman_collection.json`                                                  |

신규 제품 패키지, schema 변경, migration은 없습니다. 기존 차시 테스트의 CRUD/persistence 검증은 유지하면서 새 인증 계약에 맞춰 요청에 인증 Cookie를 추가했습니다.

## 실행과 학생 검증

기존 Docker PostgreSQL을 사용합니다. 기존 환경변수 파일의 `DATABASE_URL`, `JWT_SECRET`을 로컬에 설정하세요. 실제 비밀값은 Git에 넣지 않습니다.

```powershell
npm ci
npm run build --workspace=@campus-crew/api
npm run test:e2e --workspace=@campus-crew/api
npm test --workspace=@campus-crew/web
npm run check
```

기본 개발 서버는 기존대로 3000/4000입니다. 이번 검증에서는 이전 차시 서버를 보존하기 위해 별도 3023/4023을 사용했습니다.

```powershell
# API 터미널 (저장소 루트)
$env:PORT='4023'
npm run start:api

# 웹 빌드/실행 터미널 (저장소 루트)
$env:API_ORIGIN='http://localhost:4023'
npm run build --workspace=@campus-crew/web
node node_modules/next/dist/bin/next start apps/web --port 3023
```

`API_ORIGIN`은 Next rewrite에 쓰이므로 변경 시 개발 서버 재시작 또는 production 재빌드가 필요합니다.

### Postman

컬렉션을 Import하고 로컬 `baseUrl`을 지정한 뒤 순서대로 실행하세요. 기본은 `http://localhost:4023`입니다. 자동 Cookie jar 대신 각 요청의 명시적 Cookie로 작성자/다른 사용자를 구분합니다. 시작 시 runId를 만들고 테스트 사용자 두 명을 가입시킵니다. 반복 실행할 때는 runId를 비우거나 새 값으로 바꿉니다.

```powershell
npx --yes --package=newman newman run docs/postman/campus-crew-session-23.postman_collection.json
```

컬렉션은 자신이 만든 두 모집글을 삭제합니다. 테스트 계정은 확인할 수 있도록 남깁니다. 이번 자동 검증의 임시 계정은 별도로 정리합니다. 컬렉션을 실제 서비스 DB 대상으로 실행하지 않습니다.

검증 순서: 비로그인 POST/PATCH/DELETE 401 → invalid Cookie 401 → 두 사용자 가입/로그인 → me의 안전한 identity → 작성자 생성 201 → authorId 위조 무시 → 비작성자 PATCH/DELETE 403 → 원본 유지 → 없는 id 404 → 작성자 PATCH 200/DELETE 204 → 삭제 후 404 → 로그아웃 후 me 401.

### 실제 검증 결과 — 2026-09-19

| 항목                    | 결과                                                                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 변경 전 baseline        | API 27/27, 웹 25/25                                                                                                                                                                                                                              |
| 실패 재현               | 비로그인 POST 201(기대 401), 타인 PATCH 200(기대 403); 클라이언트 작성자 필드 및 비작성자 UI 테스트 실패 확인                                                                                                                                    |
| 최종 API 전체 e2e       | **30/30 통과**, 실제 Nest + PostgreSQL; 누락/잘못된/만료/위조 토큰, 존재하지 않는 사용자, owner check, authorId 위조, identity, Swagger 포함                                                                                                     |
| 최종 웹 테스트          | **36/36 통과**, 요청 payload, 401/403 오류 메시지, 작성자/비작성자/비로그인/loading/auth-error 렌더링 및 기존 회귀 포함                                                                                                                          |
| Postman Newman          | **22 requests / 34 assertions, 실패 0**                                                                                                                                                                                                          |
| 전체 format/lint        | 통과                                                                                                                                                                                                                                             |
| API/웹 production build | 모두 통과                                                                                                                                                                                                                                        |
| Prisma 타입 검사        | 통과                                                                                                                                                                                                                                             |
| 실제 브라우저           | 비로그인 작성 안내 → 로그인 → 작성 → 작성자 버튼 노출 → 삭제 확인창 상태에서 로그아웃 시 버튼/확인창 숨김 → 다른 사용자 로그인 후 버튼 숨김 → edit 직접 접근 안내 → 원 작성자 재로그인 → 수정 성공 → 새로고침 로그인 유지 → 삭제 성공 → 404 화면 |
| 실제 작성자 응답        | 브라우저 생성 글 id 112의 authorId/author.id가 테스트 로그인 사용자 99와 일치; 검증 뒤 삭제                                                                                                                                                      |
| DB 보존                 | e2e가 테스트 전후 기존 users/recruitments/applications snapshot 일치를 확인; seed 및 이전 차시 데이터 유지                                                                                                                                       |
| 독립 코드 리뷰          | Critical/Important 없음. 확인창→로그아웃 전환의 자동 테스트 공백은 실제 브라우저 검증으로 보완                                                                                                                                                   |

Postman 데스크톱 앱 직접 조작 대신 동일 컬렉션을 Newman으로 실행했습니다. 브라우저 DevTools Network 패널의 직접 조작은 제공 도구에 없어 수행하지 않았습니다. 정확한 POST body의 세 필드와 authorId 비포함은 HTTP request 테스트와 Postman assertion으로 확인했습니다. 실제 브라우저 요청의 Network 패널 캡처를 남겼다는 의미는 아닙니다.

Swagger 응답 decorator 추가 시 성공 코드가 자동 생성되지 않는 것을 회귀 테스트에서 발견하여 201/200/204를 명시했습니다. 웹 request 테스트의 transpile target은 실제 프로젝트와 동일한 ES2017로 맞췄습니다(기존 기본 ES5에서는 Error 상속의 instanceof가 달라짐).

## 다음 24차시 — Application 지원/취소

이번 공통 Guard와 CurrentUser를 지원/취소 API에 재사용할 수 있습니다. `applicantId`도 클라이언트 입력을 신뢰하지 않고 `user.id`로 결정하며, 취소 권한은 해당 지원의 applicantId와 비교하는 흐름으로 확장합니다. 기존 `(applicantId, recruitmentId)` unique 관계를 이용한 중복 지원 처리, 모집 상태 검사와 query cache 갱신이 다음 연결점입니다. 이번 차시에서는 Application 기능을 구현하지 않았습니다.
