# Campus Crew Course

TypeScript Fullstack **30차시 교육 프로젝트**입니다. 대학생 팀원 모집 서비스를 만들며 화면 구성부터 API·DB·인증·테스트·CI/CD·배포까지 학습합니다. 원본의 실제 Git 히스토리를 보존하고, 확인된 커밋에 annotated checkpoint 태그를 붙였습니다.

- 수업 저장소: https://github.com/camelcaramel/campus-crew-course
- 원본 프로젝트: https://github.com/camelcaramel/campus-crew
- `main`: 학생 안내와 후속 보완을 포함한 최신 통합본
- `checkpoint-03`~`checkpoint-30`: 아래 표와 [커밋 근거](docs/course-checkpoints.md)에 설명한 실제 시점
- 과거 상세 설명은 [기존 README 보관본](docs/README-history.md), 차시별 실습은 `docs/session-*.md`와 `docs/superpowers/plans/`에서 확인합니다.

## 기술 스택과 아키텍처

| 영역      | 기술                                                                      |
| --------- | ------------------------------------------------------------------------- |
| 공통      | TypeScript 5.9, npm workspaces, ESLint, Prettier                          |
| Web       | Next.js 16 App Router, React 19, Tailwind CSS 4                           |
| 데이터·폼 | TanStack Query 5, React Hook Form, Zod                                    |
| API       | NestJS 11, REST, Swagger, JWT HttpOnly Cookie, bcryptjs                   |
| DB        | PostgreSQL 17, Prisma 7, Docker Compose                                   |
| 검증·배포 | Jest/Supertest, node:test, Playwright, GitHub Actions, Neon/Render/Vercel |

정확한 설치 버전은 해당 태그의 `package-lock.json`을 따릅니다.

```text
Browser
  → Next.js Web :3000 (apps/web)
  → same-origin /api/* rewrite
  → NestJS API :4000 (apps/api)
  → Prisma → PostgreSQL

Production: Vercel → Render → Neon
Local:      Next.js → NestJS → Docker PostgreSQL
```

## 학생이 시작하는 방법

코드를 보거나 로컬에서 실행하려면 Clone합니다.

```bash
git clone https://github.com/camelcaramel/campus-crew-course.git
cd campus-crew-course
npm install
git fetch --tags
```

본인의 GitHub에 실습 기록을 남기려면 GitHub에서 **Fork**한 다음 **자신의 Fork URL**로 clone하세요. 차시 커밋 이력을 활용하므로 Template보다 Fork를 권장합니다. 기본 Fork로 가져오지 않은 보완 브랜치나 태그는 원본을 upstream으로 등록해 받을 수 있습니다.

```bash
git remote add upstream https://github.com/camelcaramel/campus-crew-course.git
git fetch upstream --tags
```

재현 가능한 설치나 태그 변경 후에는 `npm ci`를 사용합니다. 실행 전 아래 개발 환경을 준비하세요. `npm install`만으로 DB나 서버가 시작되지는 않습니다.

## 특정 차시로 이동

먼저 `git status`를 확인하고 작성 중인 코드는 자신의 실습 브랜치에 커밋하세요. 전환 충돌을 강제 삭제로 해결하지 않습니다.

**18차시 완성 상태 보기:**

```bash
git switch --detach checkpoint-18
npm ci
```

**최신 통합본으로 돌아오기:**

```bash
git switch main
npm ci
```

**18차시를 직접 따라치기:** 17차시 완료 상태에서 자기 브랜치를 만듭니다.

```bash
git switch -c practice/session-18 checkpoint-17
npm ci
```

DB와 환경 파일 준비 후 별도 터미널에서 `npm run dev:api`, `npm run dev:web`을 실행합니다. [18차시 수업 노트](docs/session-18-frontend-query-integration.md)를 따라 작성합니다.

```bash
# 정답 태그와 현재 작업 내용 비교 (새 파일은 git add 후 포함)
git diff checkpoint-18
# 17차시 → 18차시에 바뀐 내용
git diff checkpoint-17..checkpoint-18
# 해당 구간 커밋
git log checkpoint-17..checkpoint-18 --oneline
```

태그를 checkout하면 README도 그 당시 버전으로 바뀝니다. 이 안내는 GitHub의 main README를 별도 탭으로 열어 두세요. 환경 파일은 Git에서 제외되므로 태그를 바꾸어도 남습니다. 예전 차시의 `.env.example`과 비교하고, DB 구조가 다른 실습은 별도 로컬 DB로 구분하세요.

## 차시별 Checkpoint 표

실행 명령은 루트에서 실행합니다. `/`로 나열한 명령은 순서대로 또는 별도 터미널에서 실행하는 목록이며 그대로 입력하는 한 줄 명령이 아닙니다. 환경·DB가 필요한 차시는 아래 개발 환경 및 해당 시점의 수업 노트를 먼저 읽으세요.

| 차시 | 주제                                   | 시작 태그     | 완료 태그     | 상태                                      | 핵심 실행 명령                                |
| ---- | -------------------------------------- | ------------- | ------------- | ----------------------------------------- | --------------------------------------------- |
| 03   | Git 실습 이후 시작점 (대체)            | —             | checkpoint-03 | available (대체); 정확한 시점 unavailable | `npm install`                                 |
| 04   | npm workspaces · Next.js/NestJS 초기화 | checkpoint-03 | checkpoint-04 | available                                 | `npm install`                                 |
| 05   | 개발 환경 · 환경 변수 · lint/format    | checkpoint-04 | checkpoint-05 | available                                 | `npm run check`                               |
| 06   | Next.js App Router                     | checkpoint-05 | checkpoint-06 | available                                 | `npm run dev:web`                             |
| 07   | 공통 Header · Layout                   | checkpoint-06 | checkpoint-07 | available                                 | `npm run dev:web`                             |
| 08   | 모집글 목록 · mock 데이터              | checkpoint-07 | checkpoint-08 | available                                 | `npm run dev:web`                             |
| 09   | 동적 경로 · 모집글 상세                | checkpoint-08 | checkpoint-09 | available                                 | `npm run dev:web`                             |
| 10   | React Hook Form · Zod                  | checkpoint-09 | checkpoint-10 | available                                 | `npm run dev:web`                             |
| 11   | loading · error · empty UI             | checkpoint-10 | checkpoint-11 | available                                 | `npm run dev:web`                             |
| 12   | Nest Module · Controller · Service     | checkpoint-11 | checkpoint-12 | available                                 | `npm run dev:api`                             |
| 13   | REST CRUD · Swagger · Postman          | checkpoint-12 | checkpoint-13 | available                                 | `npm run dev:api`                             |
| 14   | DB 설계 · ERD                          | checkpoint-13 | checkpoint-14 | available                                 | 문서 실습                                     |
| 15   | Docker · PostgreSQL · DBeaver          | checkpoint-14 | checkpoint-15 | available                                 | `docker compose up -d`                        |
| 16   | Prisma schema · migration · seed       | checkpoint-15 | checkpoint-16 | available                                 | `npm run db:migrate -w apps/api`              |
| 17   | Prisma 모집글 CRUD                     | checkpoint-16 | checkpoint-17 | available                                 | `npm run dev:api`                             |
| 18   | TanStack Query 목록·상세 연결          | checkpoint-17 | checkpoint-18 | available                                 | `npm run dev:api / npm run dev:web`           |
| 19   | 모집글 작성 mutation                   | checkpoint-18 | checkpoint-19 | available                                 | `npm run dev:api / npm run dev:web`           |
| 20   | 모집글 수정·삭제 mutation              | checkpoint-19 | checkpoint-20 | available                                 | `npm run dev:api / npm run dev:web`           |
| 21   | 회원가입 API · bcrypt hash             | checkpoint-20 | checkpoint-21 | available                                 | `npm run dev:api`                             |
| 22   | JWT · HttpOnly Cookie 로그인           | checkpoint-21 | checkpoint-22 | available                                 | `JWT_SECRET 설정 후 dev`                      |
| 23   | 인증 Guard · 작성자 권한               | checkpoint-22 | checkpoint-23 | available                                 | `npm run dev:api / npm run dev:web`           |
| 24   | 모집글 지원·취소                       | checkpoint-23 | checkpoint-24 | available                                 | `npm run dev:api / npm run dev:web`           |
| 25   | 지원자 관리 · 승인/거절                | checkpoint-24 | checkpoint-25 | available                                 | `npm run dev:api / npm run dev:web`           |
| 26   | 검색 · 필터 · 페이지네이션             | checkpoint-25 | checkpoint-26 | available                                 | `npm run dev:api / npm run dev:web`           |
| 27   | DTO 검증 · 공통 오류 · API 테스트      | checkpoint-26 | checkpoint-27 | available                                 | `npm run test:prepare / npm test`             |
| 28   | Playwright smoke · GitHub Actions CI   | checkpoint-27 | checkpoint-28 | available                                 | `npm run test:e2e:prepare / npm run test:e2e` |
| 29   | Neon · Render · Vercel 배포 준비       | checkpoint-28 | checkpoint-29 | available                                 | `npm run db:migrate:deploy`                   |
| 30   | 운영 장애 수정 · 배포 기록 · 최종 통합 | checkpoint-29 | checkpoint-30 | available                                 | `npm run check / npm test / npm run test:e2e` |

### 실제 이력과 수업 순서의 차이

- **03:** 3차시 종료/4차시 생성 직전 커밋은 없습니다(`unavailable`). 요청한 대체 규칙에 따라 최초 커밋 `8332381`을 가리킵니다. **04와 같은 커밋이며 이미 프로젝트가 생성되어 있습니다.** 03→04 diff가 비는 것은 정상이고, 구현 전 빈 프로젝트를 복원한 태그는 아닙니다.
- **21:** `checkpoint-21`은 원래 회원가입 API·hash 구현입니다. 화면까지 포함한 추가 실습은 보존된 `lesson/session-21-signup-complete` 브랜치(`80e31ec`)를 사용합니다. [보완 안내](docs/session-21-signup-ui.md). 이 보완은 과거 22~29차시 태그에 소급되지 않습니다.
- **26:** 구현 `3b6d293`에 DB sequence 검증 설명 보완 `9c82e7b`까지 포함했습니다.
- **29:** 해당 시점은 배포 구성 **준비 완료**입니다. 실제 호스팅 검증은 이후 `4682b17` 기록으로 남아 있으며 30차시 최종 통합본에 포함됩니다. [배포 기록](docs/deployment.md).
- **30:** 최초 장애 수정·설명 `8cb95e7`~`4c0d74d`, 실제 배포 기록, 회원가입 화면 보완을 포함한 원본 최종 main `bc73b03`입니다. 29→30 비교에는 merge와 후속 보완도 포함됩니다.
- **04~30은 모두 available**입니다. 차시별 원본 커밋·계획 파일·주요 변경 근거는 [전체 매핑표](docs/course-checkpoints.md)를 참고하세요.

21차시 화면 보완을 별도로 실습하려면:

```bash
git fetch origin
git switch --no-track -c practice/session-21-ui origin/lesson/session-21-signup-complete
```

Fork에서 보완 브랜치가 없으면 위 명령의 `origin`을 앞서 등록한 `upstream`으로 바꾸세요. 과거 22차시 태그로 단순 이동하면 보완 UI는 포함되지 않습니다. 자기 실습 브랜치에서 다음 수업을 이어가거나 최신 main으로 통합 결과를 확인하세요.

## 개발 환경

- Node.js **22.17.1 이상인 22.x**, npm **10 이상**(작성·검증 기준 10.9.2). Node 23 이상은 현재 engines 범위 밖입니다.
- 15차시부터 Docker Desktop/Engine과 PostgreSQL 17, 선택적으로 DBeaver를 사용합니다.
- 실제 secret은 커밋하지 않습니다. 예제의 로컬/테스트 값은 수업용 placeholder이며 production에서 재사용하지 않습니다.
- `.env`, `.env.test`, API `.env`, Web `.env.local`은 Git에서 제외됩니다. 추적 가능한 것은 `.env.example`과 `.env.test.example`뿐입니다.

최초 한 번, 기존 파일을 덮어쓰지 않고 복사합니다.

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path apps/api/.env)) { Copy-Item apps/api/.env.example apps/api/.env }
if (!(Test-Path apps/web/.env.local)) { Copy-Item apps/web/.env.example apps/web/.env.local }
```

macOS/Linux:

```bash
test -e .env || cp .env.example .env
test -e apps/api/.env || cp apps/api/.env.example apps/api/.env
test -e apps/web/.env.local || cp apps/web/.env.example apps/web/.env.local
```

| 파일                  | 설정                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 루트 `.env`           | Docker의 POSTGRES_*와 Prisma/API의 DATABASE_URL. user/password/port를 서로 일치시킵니다.                                  |
| `apps/api/.env`       | PORT=4000. **22차시 이후 JWT_SECRET을 개인 무작위 값(32자 이상)으로 교체**합니다. 기본 placeholder로는 시작이 거절됩니다. |
| `apps/web/.env.local` | API_BASE_URL=http://localhost:4000. server-only 값이며 NEXT_PUBLIC_를 붙이지 않습니다.                                    |
| 루트 `.env.test`      | 27차시 이후 전용 테스트 DB 설정. loopback 주소와 `_test`로 끝나는 DB 이름만 허용됩니다.                                   |

API와 Prisma는 루트 `.env`를 공유합니다. 기존 셸의 환경변수가 파일보다 우선하므로 production 연결을 가진 터미널로 로컬 실습을 실행하지 마세요. 30차시 production build는 로컬에서도 API_BASE_URL을 명시해야 합니다.

```bash
docker compose up -d
docker compose ps
npm run db:migrate --workspace=@campus-crew/api
npm run db:seed --workspace=@campus-crew/api
# 서로 다른 터미널에서 실행
npm run dev:api
npm run dev:web
```

Web은 http://localhost:3000, API는 http://localhost:4000/api/recruitments, Swagger는 http://localhost:4000/docs 입니다. seed 계정의 hash는 로그인용 비밀번호가 아닙니다. main에서는 `/signup`으로 자기 로컬 계정을 만든 뒤 `/login`에서 로그인하세요. 과거 22~29차시에서는 Swagger/Postman의 signup API를 사용합니다.

## 자주 쓰는 명령

| 목적                       | 루트에서 실행                                                        |
| -------------------------- | -------------------------------------------------------------------- |
| 설치 / 잠금 버전 재설치    | `npm install` / `npm ci`                                             |
| Web / API 개발             | `npm run dev:web` / `npm run dev:api`                                |
| 로컬 DB 시작 / 상태 / 중지 | `docker compose up -d` / `docker compose ps` / `docker compose down` |
| 개발 migration / seed      | `npm run db:migrate -w apps/api` / `npm run db:seed -w apps/api`     |
| 커밋된 migration 적용      | `npm run db:migrate:deploy`                                          |
| 포맷 검사 / lint / build   | `npm run format:check` / `npm run lint` / `npm run build`            |
| 위 세 검사 순서대로        | `npm run check`                                                      |
| API + Web 테스트           | `npm test` (테스트 DB 준비 필요)                                     |
| Web 단위 테스트만          | `npm test -w apps/web`                                               |
| 전체 API 회귀 테스트       | `npm run test:e2e -w apps/api`                                       |
| 브라우저 검증              | `npm run test:e2e:prepare` → `npm run build` → `npm run test:e2e`    |

태그마다 아직 없는 script가 있을 수 있습니다. 해당 태그의 `package.json`과 수업 문서가 기준입니다. production에는 개발 migration/seed/테스트 명령을 실행하지 않습니다. `docker compose down`은 볼륨을 지우지 않습니다.

27차시 이후 테스트는 별도 DB가 필요합니다. 로컬 예제 설정을 사용하는 경우 최초 한 번:

```powershell
if (!(Test-Path .env.test)) { Copy-Item .env.test.example .env.test }
docker compose exec postgres createdb -U campus_crew campus_crew_test
npm run test:e2e:prepare
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

DB가 이미 있다면 createdb를 생략합니다. 개인 POSTGRES_USER/비밀번호/포트를 바꿨다면 명령과 `.env.test`도 맞춥니다. Playwright는 3000/4000 포트에서 전용 서버를 시작하므로 본인의 dev 서버를 먼저 종료하세요. [테스트 DB 상세](docs/session-27-validation-error-api-tests.md), [Playwright/CI](docs/session-28-playwright-ci.md).

Windows에서 npm-cli.js 경로 오류가 발생하는 경우, 설치된 Node 폴더를 해당 터미널의 임시 prefix로 지정합니다.

```powershell
$env:npm_config_prefix = Split-Path (Get-Command node).Source
npm --version
```

## 학생용 Git 흐름

**Issue → Branch → Edit → Diff → Commit → Push → PR**

1. 자신의 Fork에서 실습 Issue를 만듭니다.
2. 시작 checkpoint에서 `practice/session-XX` 브랜치를 만듭니다.
3. 코드를 작성하고 실행·검사합니다.
4. `git status`, `git diff`로 변경과 secret 미포함을 확인합니다.
5. 필요한 파일만 `git add <파일>` 후 `git commit`합니다.
6. `git push -u origin practice/session-XX`로 자신의 Fork에 push합니다.
7. 자기 Fork의 main을 대상으로 PR을 열어 설명·검증 결과를 정리합니다. 교사 제출 PR은 수업 안내가 있을 때 제출합니다.

교사 저장소의 main에 직접 push하지 않습니다. 태그의 detached HEAD는 확인용이며, 작업 기록은 항상 자기 브랜치에 남깁니다.

## 최종 완성본

- `checkpoint-30`: 원본 최종 통합 코드 `bc73b03`.
- `v1.0.0`: 위 앱 코드에 이 학생 가이드와 커밋 매핑을 더한 교육용 배포본입니다. 공개 전 로컬 테스트·빌드와 원격 CI를 확인합니다.
- GitHub의 **Tags**에서 각 시점 소스도 내려받을 수 있습니다. 커밋 흐름·diff 실습에는 ZIP보다 clone을 사용하세요.
- 이 교육용 저장소를 만드는 작업은 기존 Render/Vercel 서비스를 새 저장소에 연결하거나 재배포하지 않습니다. 기존 [배포 기록](docs/deployment.md)은 원본 환경의 과거 검증 기록입니다.
- [공개 전 secret 검사 및 검증 기록](docs/course-publication.md).
