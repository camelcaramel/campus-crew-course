# Campus Crew Session 26 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Track verification below.

**Goal:** 모집글 목록에 제목 검색, 카테고리 필터, 페이지네이션을 추가하고 URL로 목록 상태를 재현한다.

**Architecture:** 기존 Nest DTO/ValidationPipe에 목록 query DTO만 추가한다. Prisma PostgreSQL where를 findMany/count에 공유하고 items/meta를 반환한다. Next 목록은 Suspense 안에서 URL을 읽고 TanStack Query 조건 키와 API 호출에 동일한 값을 전달한다.

**Tech Stack:** Nest 11, Prisma 7.10 PostgreSQL, Next 16.3 App Router, React 19, TanStack Query 5, 기존 class-validator.

**Spec:** 이 작업의 사용자 제공 26차시 상세 요구사항. 추가 승인 대기 없이 계획 작성 후 실제 구현하라는 지시를 따른다.

## Global Constraints

- 4~25차시를 포함한 d363a16에서 별도 feat/session-26-search-filter-pagination 브랜치/worktree로 작업한다.
- 파괴적 Git 명령, 기존 커밋 수정, schema/migration 변경, 새 상태 라이브러리 추가 금지.
- title contains q, PostgreSQL insensitive; 빈 q는 조건 생략. category는 STUDY/PROJECT/CONTEST.
- page=1, limit=10, limit 최대 50. 양의 정수와 안전한 DB offset만 허용.
- createdAt desc 우선, 동률은 id desc. totalPages=Math.ceil(total/limit), 0건이면 0.
- 검색은 submit, 검색/필터 변경은 page=1, 페이지 이동은 다른 조건 유지.
- 이번 차시는 validation/error 전면 개편, 정렬 선택기, 무한 스크롤, application 페이지네이션을 포함하지 않는다.

## Review Focus

1. 문자열 숫자/중복 query/음수/소수/범위 초과가 500을 유발하지 않아야 한다.
2. 동일 createdAt에서도 페이지 간 중복 없이 정렬되어야 한다.
3. URL 뒤로가기/새로고침 시 입력과 목록 조건이 일치해야 한다.
4. 마지막 페이지 밖의 빈 목록에서도 이전/첫 페이지로 돌아갈 수 있어야 한다.
5. 검색어 특수문자와 한글이 URL에 안전하게 인코딩되어야 한다.

## Task 1: 목록 API와 통합 테스트

**Files:** apps/api/src/modules/recruitments/recruitment-list-query.dto.ts (new), recruitments.controller.ts, recruitments.service.ts, apps/api/test/recruitments.e2e.mjs.

**Interfaces:** GET /api/recruitments accepts page/limit/q/category; returns {items,meta:{page,limit,total,totalPages}}. Author remains id/name only.

- [x] 기존 API/web 테스트 baseline 실행. 기존 DB 및 이전 worktree 변경 여부 확인.
- [x] 기존 목록 검증을 items/meta, 최신순 기준으로 변경하고 새 조건 검증을 작성한다. 실제 API에서 실패를 먼저 확인한다.

```js
const body = await (
  await request('GET', '/api/recruitments?page=1&limit=2')
).json();
assert.equal(body.items.length, 2);
assert.equal(body.meta.limit, 2);
// 동일 prefix의 STUDY 3개, PROJECT 1개, CONTEST 1개 fixture:
// q+STUDY total=3, limit=2이면 totalPages=2, page2 items=1.
// 대소문자 검색, 빈 q, invalid category/page/limit, 결과 없음도 검증.
```

- [x] DTO는 문자열 query를 엄격한 정수로 변환하고 기존 class-validator로 검증한다. 전역 파이프는 변경하지 않는다.
- [x] 서비스에 아래 흐름을 구현한다.

```ts
const where: Prisma.RecruitmentWhereInput = {
  ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
  ...(category ? { category } : {}),
};
const [items, total] = await Promise.all([
  prisma.recruitment.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: authorInclude,
  }),
  prisma.recruitment.count({ where }),
]);
return {
  items,
  meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
};
```

- [x] API build + 전체 test:e2e 실행: 모두 통과 예상. fixture 정리 후 기존 데이터 snapshot 일치 확인.

## Task 2: URL 기반 프론트 목록

**Files:** apps/web/src/features/recruitments/types.ts, api.ts, recruitment-list.tsx (new), apps/web/src/app/recruitments/page.tsx, apps/web/test/recruitment-list.test.mjs (new).

**Interfaces:** getRecruitments(params: RecruitmentListParams): Promise<RecruitmentListResponse>. Params includes page/limit/q/category; key ['recruitments', params].

- [x] API client가 한글/특수문자 query를 인코딩하고 items/meta를 유지하는 테스트를 작성하여 실패 확인.
- [x] 타입과 API query 생성 구현. 필터를 queryKey에 포함하여 조건별 캐시 분리.
- [x] page.tsx는 Suspense wrapper, recruitment-list.tsx는 client 목록/검색 form/category select/이전·다음 UI.
- [x] URLSearchParams를 복사해 q/category/page를 변경하고 router.push한다. 검색 input은 URL q를 defaultValue로 갖고 URL 변경 시 key로 초기화한다.
- [x] 검색 submit과 category 변경은 page=1. 페이지 클릭은 기존 query 유지. limit도 URL에서 읽는다.
- [x] 기존 Spinner/ErrorMessage/EmptyState/RecruitmentCard 재사용. 범위 밖 page의 빈 목록에도 페이지 복귀 버튼 제공.
- [x] 웹 전체 테스트와 production build 실행: 통과 예상. 브라우저에서 submit, 필터, 페이지 이동, 새로고침, 뒤로가기, 빈 결과를 확인.

## Task 3: Postman, 수업 문서, 최종 확인

**Files:** docs/postman/campus-crew-session-26.postman_collection.json (new), docs/session-26-search-filter-pagination.md (new), 이 계획의 실행 기록.

- [x] 기존 수업 데이터를 덮어쓰지 않는 fixture로 카테고리/검색/페이지 조합을 검증한다.
- [x] Postman collection에 query와 items/meta assertion을 넣고 Newman 사용 가능 시 실행한다.
- [x] npm run format:check, npm run lint, npm run build, API/web tests, Prisma 타입 검사 실행 및 결과 기록.
- [x] 전체 변경 독립 리뷰 후 중요 결함 수정. 사용자 요청 커밋 메시지 feat: add recruitment search filter pagination으로 별도 커밋.
- [x] 파일 목록, API/Prisma/URL/queryKey, 실제 검증과 27차시 연결점을 문서 및 최종 답변에 남긴다.

## Execution Ledger

- 최종 검사: npm run check 종료 코드 0 (format:check/lint/API build/web build), db:typecheck 0. 범위 밖 페이지 복귀 브라우저 검증 완료. 요청한 단일 기능 커밋으로 보존.

- 준비: 이전 worktree clean, HEAD d363a16 확인. 새 worktree 생성 완료.
- 환경: 의존성/생성물은 동일 lockfile의 기존 설치를 새 worktree에 별도로 복사하여 이전 node_modules/dist/generated를 변경하지 않는다.
- Ruling: 시스템 npm launcher가 없는 사용자 전역 npm 경로를 가리킨다. 실제 설치된 npm CLI를 명시해 사용하며 프로젝트 설정은 바꾸지 않는다.
- Pre-flight: Task 1 items/meta 계약을 Task 2 타입/클라이언트와 Task 3 Postman이 사용한다. page/limit/q/category 명칭 및 기본값 일치.

- Task 1: complete — 기존 API 57개 baseline 통과, 변경 API 16개 RED→GREEN, 전체 API 59/59 통과.
- Task 2: complete — 웹 API client RED→GREEN, 전체 웹 70/70 통과. production Next build 통과. 브라우저 검색/필터/페이지/새로고침/뒤로가기/빈 결과 확인.
- Task 3: Postman/Newman 20 requests / 43 assertions 통과. 문서 작성 완료. 최종 검사 후 요청된 별도 커밋을 남긴다.
- Final review: 독립 reviewer가 입력 복원과 최대 page 불일치를 발견했다. 브라우저에서 두 문제를 재현하고 한 번의 수정 후 재확인했다. 전체 API59/web70도 통과했다.
- Ruling: 마지막 페이지 밖 목록은 빈 items와 실제 total을 유지하고 첫 페이지 버튼을 제공한다. offset pagination의 동시 추가/삭제 변동은 요청 범위대로 유지한다.
- Ruling: npm 네트워크 접근이 EACCES로 막혔고 Next는 외부 junction을 거부했다. 동일 버전 설치의 실물 복사로 해결했으며 lockfile/schema/migration은 변경하지 않았다.
- Ruling: Network 패널 직접 제어가 없어 검증용 API launcher로 브라우저 GET query를 기록했다. 실제 URL q/category/page/limit 전달을 확인했고 추적 코드는 제품에 포함하지 않는다.
- 데이터 보존: 임시 fixture 정리 뒤 users/recruitments/applications 전체 snapshot hash가 준비 전과 일치했다. 이전 25차시 worktree는 clean, HEAD d363a16 유지.
