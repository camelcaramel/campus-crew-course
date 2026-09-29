# 26차시 — 모집글 검색·카테고리 필터·페이지네이션

## 구현 범위

25차시 커밋 `d363a16`에서 `feat/session-26-search-filter-pagination` 브랜치를 만들었다. 4~25차시 구현과 schema/migration/lockfile은 보존했다. 목록 응답만 배열에서 items/meta 객체로 변경하고 기존 프론트와 API 테스트를 함께 수정했다.

## 목록 API

```http
GET /api/recruitments?page=1&limit=10&q=react&category=STUDY
```

| Query    | 기본값 | 정책                                                     |
| -------- | ------ | -------------------------------------------------------- |
| page     | 1      | 양의 정수, 최대 2147483647                               |
| limit    | 10     | 1~50 정수                                                |
| q        | 생략   | 제목 contains 검색, 대소문자 무시, 빈 문자열은 조건 생략 |
| category | 생략   | STUDY / PROJECT / CONTEST 중 하나, 생략하면 전체         |

문자열 숫자를 엄격하게 변환한다. `page=1abc`, `page=1.5`, 빈 page/limit, 반복 query가 만든 배열, 잘못된 category는 400이다. `skip`이 PostgreSQL 정수 범위를 넘는 조합도 400이다. 기존 class-validator 및 전역 ValidationPipe를 활용하고 목록 query에만 변환 pipe를 추가했다.

```json
{
  "items": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0
  }
}
```

items의 각 모집글 필드는 이전과 같고, author는 id/name만 반환한다. total은 현재 검색/필터에 맞는 전체 행 수이며 items.length와 다르다. 실제 23건에 limit=10이면 totalPages=3이다. 결과가 없으면 totalPages=0이다. 마지막 페이지를 넘으면 items는 비어 있어도 실제 total/totalPages를 반환한다.

## Prisma 흐름

1. `Prisma.RecruitmentWhereInput` 타입으로 where를 만든다.
2. q가 있으면 `title: { contains: q, mode: 'insensitive' }`를 추가한다.
3. category가 있으면 정확히 일치하는 조건을 추가한다.
4. `skip = (page - 1) * limit`, `take = limit`으로 현재 페이지를 조회한다.
5. 같은 where로 `count`하여 total을 구한다.
6. 두 조회는 Promise.all로 실행하며 `Math.ceil(total / limit)`을 반환한다.
7. `createdAt desc`가 우선이며, 같은 시각의 글은 `id desc`로 순서를 고정한다.

Prisma 7.10의 실제 generated PostgreSQL 타입으로 컴파일/타입 검사를 통과했다. [Prisma filtering 공식 문서](https://docs.prisma.io/docs/orm/v6/prisma-client/queries/filtering-and-sorting)의 contains/mode 방식과 일치한다. contains는 PostgreSQL LIKE/ILIKE 패턴 동작을 따른다. 고급 검색, content 검색, 인덱스 변경은 추가하지 않았다.

offset 방식이므로 다른 사용자가 글을 추가/삭제하는 동안 페이지를 이동하면 경계가 바뀔 수 있다. count와 items도 별도 조회이므로 동시 변경 시 완전한 snapshot 일관성은 보장하지 않는다. 이번 수업에서 요구한 단순 offset/Promise.all 방식을 유지한다.

## 프론트 URL과 캐시

```text
/recruitments?q=react&category=STUDY&page=2
/recruitments?q=react&category=STUDY&page=2&limit=2
```

App Router의 useSearchParams/useRouter/usePathname을 사용한다. page.tsx의 Suspense가 Client Component인 RecruitmentList를 감싼다. [Next.js useSearchParams 공식 문서](https://nextjs.org/docs/app/api-reference/functions/use-search-params)의 정적 빌드 패턴을 적용했다.

- URL이 확정된 목록 조건이다. 입력 중인 검색어는 제출 전까지 요청하지 않는다.
- 검색 제출: 입력 앞뒤 공백을 정리하고 q 변경 + page=1.
- 카테고리 변경: category 변경 + page=1. 전체 선택 시 category를 제거한다.
- 이전/다음: page만 변경하고 q/category/limit을 유지한다.
- 새로고침/공유/뒤로가기: URL 조건으로 목록과 입력을 복원한다. input의 key는 전체 URL query 문자열이다.
- 유효하지 않은 프론트 숫자는 기본값으로 읽는다. 직접 API에 잘못된 값을 보내면 400이다.
- 기존 Spinner, ErrorMessage와 재시도, EmptyState, RecruitmentCard를 재사용한다.
- meta.totalPages로 이전/다음을 제어하고, 범위 밖 빈 페이지에는 첫 페이지 복귀 버튼도 제공한다.

```ts
const params = { q, category, page, limit };
useQuery({
  queryKey: ['recruitments', params],
  queryFn: () => getRecruitments(params),
});
```

getRecruitments는 URLSearchParams로 인코딩하며 Promise<RecruitmentListResponse>를 반환한다. 키에 limit도 들어가므로 페이지 크기가 달라도 캐시가 분리된다. 기존 생성/수정/삭제의 ['recruitments'] prefix invalidate는 조건별 목록에도 적용된다. Devtools나 전역 상태 라이브러리는 추가하지 않았다.

## 학생 실습

1. 기존 seed/수업 DB를 유지하고 서로 다른 카테고리의 모집글을 준비한다.
2. `?page=1&limit=2`와 `?page=2&limit=2`에서 서로 다른 두 글을 확인한다.
3. q만, category만, q+category를 각각 조회한다.
4. 응답 items.length, total, totalPages 차이를 설명한다.
5. 브라우저 검색 입력 중 URL이 유지되고 검색 제출 후 q/page가 바뀌는지 확인한다.
6. page=2에서 카테고리를 바꾸면 page=1로 돌아오는지 확인한다.
7. 새로고침과 URL 공유로 조건이 복원되는지 확인한다.
8. 없는 검색어는 EmptyState, API 오류는 ErrorMessage와 재시도를 확인한다.
9. Network에서 `/api/recruitments?page=...&limit=...&q=...&category=...` 요청을 확인한다.
10. 검색 후 page=2에서 다른 단어를 입력만 하고 뒤로가면 URL의 기존 검색어로 복원되는지 확인한다.

## Postman

`docs/postman/campus-crew-session-26.postman_collection.json`을 가져온다. 이 컬렉션은 GET만 실행한다.

- baseUrl: 기본 http://localhost:4000, 이번 검증은 http://127.0.0.1:4026.
- searchPrefix: 다른 데이터와 겹치지 않는 접두사. 기본 S26-demo-.
- 제목이 searchPrefix + React로 시작하는 글을 STUDY 3개, PROJECT 1개, CONTEST 1개 준비한다.
- 별도 글 1개는 본문에만 같은 검색어를 넣는다. 제목 검색에서 제외되어야 한다.
- 기본값/페이지 1·2/대소문자/각 카테고리/조합/0건/범위 밖 페이지/빈 q/잘못된 query를 실행한다.

컬렉션은 20 requests, 43 assertions다. 실행 fixture는 검증 뒤 해당 실행에서 만든 id와 접두사가 모두 일치하는 행만 정리했다.

## 실제 검증 기록

- Baseline: API 57/57, 웹 69/69 통과.
- RED: 새 API 응답·조건·validation 테스트와 웹 query 인코딩 테스트가 구현 전 실패함을 확인.
- API 전체: 59/59 통과. 실제 Nest/Prisma/PostgreSQL에서 검색·필터·페이지·count·동률 정렬·400을 확인하고 기존 인증/지원/승인 테스트도 통과.
- 웹 전체: 70/70 통과. 실제 API client가 한글 및 &를 인코딩하고 items/meta를 유지하는 회귀 테스트 포함.
- Postman/Newman: 20 requests / 43 assertions, 실패 0.
- 브라우저: 검색 제출, 입력 중 목록 유지, STUDY/PROJECT 필터, page=1 초기화, 다른 항목으로 페이지 이동, 마지막 다음 버튼 비활성화, 새로고침, 뒤로가기, EmptyState, 초기 로딩 확인.
- 독립 리뷰의 입력 복원 문제를 실제 브라우저에서 재현 후 수정하여 재확인. limit=1의 최대 page 불일치도 오류 화면 재현 후 기본 페이지 복귀 확인.
- 브라우저 Network 패널은 제공 도구로 직접 열지 못했다. 대신 임시 검증 launcher에서 해당 GET URL만 기록하여 실제 브라우저 → Next rewrite → API 요청을 확인했다. 인증 정보는 기록하지 않았으며 추적 코드는 저장소에 포함하지 않는다.
- 검증용 포트: API 4026, 웹 3026. DB는 기존 별도 검증 PostgreSQL(5424)을 사용했다. 기존 DB 초기화/seed 덮어쓰기 없음.
- 환경: 네트워크 제한으로 npm ci가 EACCES로 실패하여 동일 lockfile의 기존 로컬 설치를 새 worktree로 복사했다. Next는 외부 node_modules junction을 허용하지 않아 실제 복사본으로 빌드했다. schema engine도 로컬 경로로 지정했다. 제품 설정/의존성 버전 변경 없음.

## 최종 확인

최종 `npm run check` (format:check, API/web lint, API/web production build)와 Prisma `db:typecheck`는 모두 종료 코드 0으로 통과했다. 범위 밖 page=99에서 첫 페이지 복귀도 브라우저에서 확인했다. 검증용 행 정리 후 기존 세 테이블의 전체 snapshot hash가 일치하며, 25차시 worktree는 clean이고 HEAD `d363a16`을 유지한다. DB sequence 값은 테스트 실행으로 증가할 수 있다.

독립 리뷰에서 발견한 두 항목은 모두 수정했다. 동시 쓰기 중 offset 경계 변동은 위에 설명한 수업 범위의 제한으로 남는다. 작업은 별도 로컬 브랜치에 커밋하며 merge/push하지 않는다.

## 변경 파일

| 파일                                                                                 | 역할                                         |
| ------------------------------------------------------------------------------------ | -------------------------------------------- |
| apps/api/src/modules/recruitments/recruitment-list-query.dto.ts                      | query 기본값·숫자 변환·최소 검증·Swagger     |
| apps/api/src/modules/recruitments/recruitments.controller.ts                         | query DTO 수신                               |
| apps/api/src/modules/recruitments/recruitments.service.ts                            | where/skip/take/count 및 items/meta          |
| apps/api/test/recruitments.e2e.mjs                                                   | 기존 응답 적응 및 실제 DB 검색·페이지 테스트 |
| apps/web/src/app/recruitments/page.tsx                                               | Suspense 경계                                |
| apps/web/src/features/recruitments/recruitment-list.tsx                              | URL·검색 form·필터·페이지 UI                 |
| apps/web/src/features/recruitments/api.ts                                            | query string 생성                            |
| apps/web/src/features/recruitments/types.ts                                          | 목록 params/response 타입                    |
| apps/web/test/recruitment-list.test.mjs                                              | API query 인코딩·응답 계약 테스트            |
| docs/postman/campus-crew-session-26.postman_collection.json                          | 조합 query 검증                              |
| docs/superpowers/plans/2026-09-22-campus-crew-session-26-search-filter-pagination.md | 사전 계획 및 실행 기록                       |
| docs/session-26-search-filter-pagination.md                                          | 이 문서                                      |

## 27차시 연결

path parameter는 특정 자원(id), query parameter는 목록 조회 조건이다. where/contains로 대상을 고르고 skip/take로 일부만 내려주기 때문에 count와 meta가 필요하다. URL을 상태로 사용하면 새로고침/공유가 쉽고, 조건을 queryKey에 넣으면 캐시가 섞이지 않는다. 검색/필터 변경 때 page=1로 돌아가야 이전 결과의 높은 페이지가 새 결과의 빈 페이지를 가리키지 않는다.

27차시에는 DTO validation 정책과 공통 오류 응답을 정리하고 정상 요청/잘못된 query/없는 자원의 대표 API 테스트를 고른다. 이번에 작성한 기본값·400·items/meta 검증을 출발점으로 사용한다. 전면 validation/error 개편은 이번 변경에 포함하지 않았다.
