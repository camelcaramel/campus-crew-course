# 28차시 — Playwright Smoke Test와 GitHub Actions CI

사람이 매번 확인하던 **로그인 → 모집글 목록 → 상세 화면**을 실제 Chromium으로 검증합니다. 27차시 API 테스트와 기존 웹 테스트는 그대로 유지합니다. 앱 기능, DB 스키마, 기존 migration과 teacher/student seed 계정은 변경하지 않습니다.

## 테스트가 맡는 역할

| 종류                      | 확인하는 것                                      | 이번 수업의 예                      |
| ------------------------- | ------------------------------------------------ | ----------------------------------- |
| 단위/컴포넌트 테스트      | 작은 함수나 UI의 동작                            | 기존 웹 API client와 폼 상태 테스트 |
| Jest/Supertest API 테스트 | HTTP 요청·검증·인증·DB 결과                      | 27차시 200/400/401/404/409          |
| Playwright E2E            | 브라우저부터 Next → Nest → PostgreSQL까지의 연결 | 로그인하고 모집글 상세 읽기         |

Smoke Test는 모든 경우를 검사하지 않습니다. 중요한 경로 하나가 살아 있는지 확인합니다. 브라우저 테스트는 API 테스트보다 느리고 환경·데이터에 영향을 받으므로 happy path 하나부터 시작합니다.

## 구성

- Playwright **1.63.0**, Chromium 하나, worker 하나, 기본 headless, retry 0.
- `apps/web/playwright.config.ts`: baseURL `http://127.0.0.1:3000`. 실패한 trace와 screenshot만 보관하고 video는 사용하지 않습니다.
- `apps/web/e2e/recruitment-smoke.spec.ts`: 실제 로그인, 인증된 헤더, 목록 heading, 고정 모집글 링크, 상세 title/content, 새로고침 후 세션 유지 확인.
- `getByLabel('이메일')`, `getByLabel('비밀번호')`, `getByRole('button'/'heading'/'link')`로 사용자가 인식하는 의미를 선택합니다. CSS class, 임의 대기 시간, API mock은 없습니다.
- 고정 모집글 제목에 E2E 이메일을 포함하고 전체 제목을 검색 query로 찾습니다. 같은 DB에서 다른 E2E 계정을 준비해도 각자의 글 하나를 선택합니다. 최신순 정렬이나 첫 페이지의 다른 데이터가 선택을 바꾸지 않습니다.
- Playwright의 `webServer` 두 개가 **빌드된** Nest 4000과 Next 3000을 시작하고 테스트 후 종료합니다. 기존 서버를 재사용하지 않으므로 다른 DB에 연결된 서버를 우연히 검사하지 않습니다.
- Nest는 HTTP 로컬 테스트이므로 `NODE_ENV=test`, Next는 빌드 결과를 실행하므로 `NODE_ENV=production`입니다. 실제 배포의 HTTPS/Secure cookie 설정은 29차시에서 다룹니다.

## 테스트 DB와 계정

기존 seed의 teacher/student 비밀번호는 placeholder입니다. 로그인 계정으로 사용하지 않습니다. `test:e2e:prepare`는 27차시 준비 절차를 재사용한 뒤 E2E fixture만 추가합니다.

1. `.env.test` 또는 프로세스의 `TEST_DATABASE_URL`을 검사합니다. loopback 주소, `_test`로 끝나는 DB 이름, `schema` query만 허용합니다. 개발용 `DATABASE_URL`로 대체하지 않습니다.
2. 기존 migration과 원래 seed를 실행합니다.
3. `E2E_EMAIL`과 `E2E_PASSWORD`로 전용 사용자를 준비합니다. bcrypt 해시를 저장하고 고정 모집글 하나를 만듭니다.

계정 예시는 `.env.test.example`에 있습니다. `E2E_EMAIL`은 소문자 `example.test` 주소만 허용합니다. 비밀번호는 실제 로그인 규칙과 동일한 8~50자, UTF-8 72바이트 이하입니다. 준비를 반복해도 같은 계정/글을 재사용하며 해당 E2E 계정의 비밀번호만 현재 환경변수에 맞춥니다. 기존 수업 계정과 글은 바꾸지 않습니다. 준비 스크립트는 순차 실행합니다.

브라우저 smoke 자체는 로그인 후 읽기만 수행합니다. 모집글 생성·수정·지원·삭제는 하지 않습니다. `.env.test`, 보고서, trace와 screenshot은 Git에서 제외합니다. 보고서는 로그인 입력이나 cookie를 포함할 수 있으므로 이 fixture에는 재사용하지 않는 테스트용 비밀번호만 사용합니다.

## 로컬 실행 — 저장소 루트

Node 22.17.1 이상, npm 10 이상, Docker Desktop을 준비합니다. 아래 예시는 원래 Compose의 로컬 학습용 접속 정보와 5432 포트를 사용합니다. 이미 DB가 실행 중이면 해당 컨테이너와 포트를 사용하고 새 컨테이너를 중복 실행하지 않습니다.

```sh
# 최초 한 번만 복사합니다. 기존 환경 파일은 덮어쓰지 않습니다.
cp .env.example .env
cp .env.test.example .env.test
docker compose up -d postgres
docker compose exec postgres pg_isready -U campus_crew -d campus_crew

# 테스트 DB가 없을 때 최초 한 번만 실행합니다.
docker compose exec postgres createdb -U campus_crew campus_crew_test

npm ci
npm run test:e2e:prepare
npm run format:check
npm run lint
npm test

# Prisma build와 Next rewrites에 필요한 값을 현재 터미널에 지정합니다.
export DATABASE_URL='postgresql://campus_crew:campus_crew@127.0.0.1:5432/campus_crew_test?schema=public'
export API_ORIGIN='http://127.0.0.1:4000'
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:e2e:report
```

Windows PowerShell에서는 최초 복사를 `Copy-Item`으로 실행하고, `export` 두 줄 대신 아래를 사용합니다. URL은 자신의 `.env.test`와 일치시킵니다.

```powershell
$env:DATABASE_URL = 'postgresql://campus_crew:campus_crew@127.0.0.1:5432/campus_crew_test?schema=public'
$env:API_ORIGIN = 'http://127.0.0.1:4000'
```

`.env.test`는 테스트 준비/Playwright가 자동으로 읽지만 `npm run build`는 자동으로 읽지 않습니다. 기존 루트 `.env`의 Prisma 설정을 사용해도 build는 데이터를 수정하지 않지만, 위처럼 테스트 URL을 명시하면 실행 환경을 이해하기 쉽습니다. `API_ORIGIN`은 Next 빌드 전에 지정해야 합니다.

API/Web 개발 서버가 4000/3000을 사용 중이면 그 터미널에서 종료한 뒤 smoke를 실행합니다. 별도로 `dev:api`/`dev:web`를 실행할 필요는 없습니다. 소스나 `API_ORIGIN`을 바꾼 후에는 다시 build합니다. `test:e2e:report`는 HTML 보고서 서버를 열므로 확인 후 Ctrl+C로 종료합니다.

| 루트 명령                      | 역할                                                 |
| ------------------------------ | ---------------------------------------------------- |
| `npm run test:prepare`         | 기존 27차시 DB migration/seed                        |
| `npm run test:e2e:prepare`     | 위 준비 + 28차시 로그인 fixture                      |
| `npm test`                     | workspace API Jest/Supertest + 기존 웹 테스트        |
| `npm run test:e2e`             | Chromium smoke                                       |
| `npm run test:e2e:report`      | HTML 보고서                                          |
| `npm run test:e2e -w apps/api` | **기존 의미 유지:** Jest + 과거 API 회귀 테스트 전체 |

## CI에서 같은 명령 실행하기

`.github/workflows/ci.yml`은 PR 및 main push마다 하나의 `quality` job을 실행합니다. Node 22, npm cache, `npm ci`를 사용합니다.

`checkout → setup-node → npm ci → format:check → lint → migration/seed/E2E fixture → npm test → build → Chromium install → browser smoke`

PostgreSQL **17**은 기존 Compose와 같습니다. GitHub runner에 service container로 생성하고 5432로 연결합니다. `campus_crew_test` DB와 CI용 공개 더미 비밀번호/JWT만 사용하며 Neon이나 운영 secret은 필요 없습니다. health check가 DB 준비를 기다립니다. job이 끝나면 이 DB 환경도 폐기됩니다. 앱 서버는 Playwright가 시작하고 종료합니다.

브랜치를 push하고 PR을 열면 **Checks → CI → quality**에서 실행을 확인합니다. main push도 실행되지만 기능 브랜치 push만으로는 이 workflow가 실행되지 않습니다. 4~27차시가 아직 main에 합쳐지지 않았다면 해당 이력을 포함하는 PR 범위를 먼저 확인합니다.

로그는 가장 먼저 실패한 step부터 읽습니다.

- Format check: 출력된 파일만 formatter로 수정합니다.
- Lint: 파일·줄 번호·규칙을 확인합니다.
- API and web tests: 실패한 테스트명과 기대값/실제값을 봅니다.
- Build: TypeScript 또는 빌드 오류를 확인합니다.
- Browser smoke: 실패한 locator와 URL을 보고, 실행 화면 아래 Artifacts의 `playwright-failure`를 내려받습니다. 실패 보고서와 screenshot/trace는 7일 보관합니다.

실패한 smoke의 로컬 HTML 보고서에서 동작별 trace를 확인할 수 있습니다. 수업에서 실패를 보여주려면 로컬에서 heading 기대값 하나를 틀리게 바꿨다가 복원합니다. 의도적인 실패는 커밋·push하지 않습니다. 자동화는 반복 검증을 맡기는 수단이며 접근성·사용성·설계의 사람 검토도 계속 필요합니다.

CI 파일만 추가한다고 merge가 강제로 차단되지는 않습니다. 저장소의 branch protection/ruleset에서 `quality`를 required check로 지정하면 merge gate로 사용할 수 있습니다. 이번 구현은 저장소 관리 설정을 변경하지 않습니다.

## 50분 수업 흐름

| 시간    | 활동                                                    |
| ------- | ------------------------------------------------------- |
| 0~8분   | Jest/Supertest와 브라우저 E2E 차이, smoke 범위          |
| 8~18분  | 테스트 DB/계정 준비, config와 role/label 읽기           |
| 18~30분 | 로그인 → 목록 → 상세 실행, 로컬 실패와 보고서 확인      |
| 30~43분 | workflow의 명령과 Postgres service, PR Checks 로그 읽기 |
| 43~50분 | 체크리스트와 29차시 배포 연결                           |

완료 기준: 학생이 smoke를 직접 실행하고, 실패한 locator를 찾고, CI의 format/lint/test/build/browser 단계를 설명할 수 있습니다. 29차시에는 이 검증을 통과한 커밋을 Neon + Render + Vercel에 연결합니다. 배포용 URL, 환경변수, migration과 HTTPS cookie는 별도로 검증하며 이번 차시에 CD를 추가하지 않습니다.

공식 참고: [Playwright webServer](https://playwright.dev/docs/test-webserver), [Playwright CI](https://playwright.dev/docs/ci-intro), [GitHub PostgreSQL service](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers).

## 이번 구현의 검증 결과

2026-09-23 Windows / Node 22.17.1 / npm 10.9.2에서 다음을 확인했습니다.

| 검증                              | 결과                                               |
| --------------------------------- | -------------------------------------------------- |
| `npm ci`                          | 1028개 패키지 설치 성공                            |
| format / lint                     | 통과                                               |
| API Jest/Supertest                | 63개 통과                                          |
| 기존 웹 테스트                    | 71개 통과                                          |
| 이전 차시 API 회귀 테스트         | 59개 통과                                          |
| Prisma 타입 검사 / API·Next build | 통과                                               |
| Chromium smoke                    | 기본 계정 연속 2회 및 다른 E2E 계정 통과           |
| 잘못된 비밀번호                   | 로그인 단계 실패 감지, screenshot/trace 생성       |
| 반복 데이터 준비                  | 중복 없음, 기존 수업 레코드 동일, bcrypt 검증 통과 |
| CI YAML                           | 구문·trigger·service·step 정적 검사 통과           |

로컬 검증은 기존 PostgreSQL 17 컨테이너의 5424 매핑에서 **새로 만든 `campus_crew_session28_test`만** 사용했습니다. CI의 Postgres 포트는 5432입니다. 운영 DB/Neon은 사용하지 않았습니다. GitHub Actions 원격 실행과 push/PR은 수행하지 않았으므로 원격 CI 통과를 뜻하지는 않습니다.

최종 코드 리뷰에서 계정 변경 시 제목 중복 문제를 실제 재현하고 계정별 제목으로 수정했습니다. 기존 앱 소스, 원래 seed, migration은 27차시와 동일합니다. 패키지 설치에서 기존 의존성의 deprecated 경고, 브라우저 실행에서 터미널 색상 환경변수 경고가 있었지만 검증 실패는 없었습니다.
