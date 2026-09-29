> 원본 main bc73b03의 README를 보존한 과거 차시 기록입니다. 아래의 “현재” 및 배포/태그 상태는 각 작성 당시를 뜻합니다. 최신 학생 시작법과 태그 목록은 [루트 README](../README.md)를 사용하세요.

# Campus Crew

30차시 v1.0 준비: production API proxy 설정 누락 방지와 운영 실습은 [incident 기록](incident-30.md)을 참고하세요. 실제 hosted smoke와 v1.0 tag는 검증 완료 전까지 보류합니다.

## 20차시: 모집글 수정·삭제 mutation

공통 RecruitmentForm을 create/edit 화면에서 재사용하고, 실제 PATCH와 DELETE를 useMutation으로 연결합니다. 성공 후 목록·상세 캐시를 갱신하며 삭제 전 confirm과 pending/error UI를 제공합니다.

- [20차시 구현·학습 포인트·검증](session-20-edit-delete-mutations.md)
- [20차시 구현 계획](superpowers/plans/2026-09-19-campus-crew-session-20-edit-delete-mutations.md)
- 실행: 기존 DB를 유지한 채 `npm run dev:api`, `npm run dev:web`; 모집글 상세의 수정/삭제 버튼에서 시작합니다.
- 다음 21차시는 signup + password hash입니다. 실제 작성자 권한 검사는 23차시 backend authorization에서 구현합니다.

## 19차시: 모집글 작성 mutation

기존 RHF + Zod 폼에서 실제 POST를 보내고, 성공하면 목록 캐시를 무효화한 뒤 목록으로 이동합니다. 요청 중 버튼을 비활성화하고 서버 오류는 폼 안에 표시합니다.

- [19차시 구현·학습 포인트·실제 검증](session-19-create-mutation.md)
- [19차시 구현 계획](superpowers/plans/2026-09-19-campus-crew-session-19-create-mutation.md)
- 실행: 기존 DB를 유지한 채 `npm run dev:api`, `npm run dev:web`; [모집글 작성](http://localhost:3000/recruitments/new)
- 임시 작성자는 `features/recruitments/api.ts`의 `DEMO_AUTHOR_ID` 한 곳에서 관리합니다. 현재 DB의 teacher ID는 1입니다.

## 18차시: TanStack Query로 모집글 조회 연결

18차시에서는 Next의 모집글 목록·상세를 same-origin `/api/*`로 Nest와 PostgreSQL에 연결했습니다. TanStack Query `5.103.1`을 사용하며, 당시 작성 폼은 유효한 제출 값을 화면에서 확인하는 단계였습니다.

- [18차시 구조·실행·학습 포인트·검증](session-18-frontend-query-integration.md)
- [18차시 구현 계획](superpowers/plans/2026-09-19-campus-crew-session-18-frontend-query-integration.md)
- 실행: DB가 준비된 상태에서 별도 터미널로 `npm run dev:api`, `npm run dev:web`; [모집글 목록](http://localhost:3000/recruitments)
- 검사: `npm run check`, `npm test --workspace=@campus-crew/web`, `npm run test:e2e --workspace=@campus-crew/api`

## 17차시: Prisma Recruitment CRUD

현재 API는 PostgreSQL을 사용합니다. 실행 전에 루트 `.env`의 `DATABASE_URL`과 16차시 migration/seed가 필요합니다. `npm run dev:api`와 API build는 Prisma Client를 자동 생성합니다.

- [17차시 실행·CRUD·영속성 확인](session-17-prisma-crud.md)
- [17차시 Postman collection](postman/campus-crew-session-17.postman_collection.json)
- [17차시 구현 계획](superpowers/plans/2026-09-19-campus-crew-session-17-recruitment-prisma-crud.md)

아래의 과거 checkpoint 설명은 해당 차시의 기록입니다. 현재 API 시작에는 DB 연결이 필요하고, 18차시 web 목록·상세는 실제 API를 사용합니다.

## 15차시: 로컬 DB 실행

Docker를 실행하고 루트 `.env.example`을 `.env`로 최초 한 번 복사한 뒤 실행합니다. 기존 `.env`는 덮어쓰지 않습니다.

```bash
docker compose up -d
docker compose ps
docker compose down
```

DBeaver 접속 정보와 재시작 실습은 [15차시 로컬 DB 안내](session-15-local-database.md)를 참고하세요. 아래는 기존 앱 실행 안내입니다.

TypeScript 풀스택 30차시 수업의 **7차시 checkpoint**입니다. 하나의 저장소에 Next.js 웹과 NestJS API를 두고, npm workspaces로 설치·실행합니다.

기존 개발 규칙과 두 라우트를 유지하면서 Figma 기준의 Header와 Container를 추가했습니다. 이전 실습은 [4차시](session-04-checkpoint.md), [5차시](session-05-checkpoint.md), [6차시](session-06-checkpoint.md), 이번 실습과 검증 결과는 [7차시 checkpoint](session-07-checkpoint.md)를 참고하세요.

## 7차시 목표

- Figma의 Header와 Container를 같은 이름의 React 컴포넌트로 옮깁니다.
- `components/layout/header.tsx`와 `container.tsx`를 `app/layout.tsx`에서 조립합니다.
- Header 64px, 실제 content 최대 폭 1120px, 좌우 padding 32px을 설명합니다.
- 비로그인 메뉴를 배치합니다. 모집글과 로고는 Link로 연결하고 로그인·회원가입은 인증 차시까지 비활성으로 둡니다.

## 6차시 목표

- `/`와 `/recruitments`를 각각의 `page.tsx` 파일과 연결해 설명합니다.
- `layout.tsx`의 공통 헤더와 `children`의 역할을 이해합니다.
- Next.js `Link`로 두 페이지를 오가고 직접 접속·새로고침을 확인합니다.

## 5차시 목표

- ESLint로 코드 규칙을, Prettier로 포맷을 검사합니다.
- 앱별 환경 파일과 공개 가능한 값·비밀 값을 구분합니다.
- 파일을 어느 폴더에 둘지 설명하고, 루트 `npm run check`를 통과합니다.

## 4차시 목표

- 프로젝트 루트와 두 앱의 역할을 구분합니다.
- 개발 서버 두 개를 실행하고 브라우저에서 응답을 확인합니다.
- TypeScript, ESLint, Prettier, build의 역할을 설명합니다.

현재 web은 공통 Header/Container와 홈·모집글 안내 페이지, api는 시작 응답만 구현되어 있습니다. 로그인, 데이터베이스, 모집 CRUD, web에서 API 호출하기, 나머지 Figma 화면 구현은 후속 차시에서 진행합니다.

## 준비

- Node.js **22.17.1 이상**: 수업에서는 Node.js 22 LTS 계열을 사용합니다.
- npm **10 이상**: checkpoint 작성 시 npm 10.9.2로 검증합니다.
- Git, 코드 편집기, 터미널 두 개.

```bash
node --version
npm --version
```

기존 web/API 실행에는 전역 Next.js/Nest CLI 설치와 Docker가 필요하지 않습니다. 15차시 DB 실습에는 Docker가 필요합니다. 환경 파일 없이도 시작 화면과 API 기본 포트 4000이 동작합니다. 5차시에서는 아래 예제를 복사해 설정 변경을 실습합니다. 패키지 최초 설치에는 인터넷 연결이 필요합니다.

## 설치와 실행

터미널에서 이 `README.md`와 루트 `package.json`이 있는 `campus-crew` 폴더로 이동합니다.

```bash
npm ci
```

`npm ci`는 함께 제공한 `package-lock.json`대로 설치합니다. 패키지를 의도적으로 추가·변경할 때만 `npm install`을 사용하고 lockfile도 함께 커밋합니다. 각 앱 폴더에서 별도 설치할 필요가 없습니다.

터미널 1 — web:

```bash
npm run dev:web
```

[http://localhost:3000](http://localhost:3000)에서 `Campus Crew` 홈 화면을 확인합니다. 공통 헤더의 모집글 링크로 [모집글 안내 페이지](http://localhost:3000/recruitments)에 이동하고 Campus Crew 로고로 돌아옵니다.

터미널 2 — api:

```bash
npm run dev:api
```

[http://localhost:4000](http://localhost:4000)에서 아래 JSON을 확인합니다.

```json
{ "message": "Campus Crew API is running" }
```

web은 API가 꺼져 있어도 동작합니다. 두 서버를 종료하려면 각각의 터미널에서 `Ctrl+C`를 누릅니다. Windows에서 일괄 작업 종료 여부를 물으면 `Y`를 입력합니다.

`dev`는 파일 변경을 감지하므로, 개발 중에는 서버를 매번 다시 시작하지 않아도 됩니다. web은 Next.js Fast Refresh, api는 Nest watch 모드를 사용합니다.

## 명령 모음

모든 명령은 프로젝트 루트에서 실행합니다.

| 명령                   | 역할                                                      |
| ---------------------- | --------------------------------------------------------- |
| `npm ci`               | 잠금 파일 기준으로 두 앱과 공통 도구 설치                 |
| `npm run dev:web`      | web 개발 서버, 3000번 포트                                |
| `npm run dev:api`      | api 개발 서버, PORT 환경 변수 또는 기본 4000              |
| `npm run lint`         | 두 앱의 코드 규칙 검사; 파일은 수정하지 않음              |
| `npm run build`        | 두 앱의 타입 검사와 실행용 결과물 생성                    |
| `npm run format:check` | 코드와 문서의 포맷 검사                                   |
| `npm run format`       | Prettier로 코드와 문서 포맷 수정                          |
| `npm run check`        | format:check → lint → build를 순서대로 실행; 실패 시 중단 |
| `npm run start:web`    | 빌드된 web 실행, 3000번 포트                              |
| `npm run start:api`    | 빌드된 api 실행, PORT 환경 변수 또는 기본 4000            |

앱 하나만 검사하거나 빌드할 수도 있습니다.

```bash
npm run lint --workspace=@campus-crew/web
npm run build --workspace=@campus-crew/web
npm run lint --workspace=@campus-crew/api
npm run build --workspace=@campus-crew/api
```

`--workspace`는 어느 앱의 `package.json`에 있는 스크립트를 실행할지 지정합니다. `--workspaces`는 두 앱의 스크립트를 순서대로 실행합니다. 개발 서버는 계속 실행되므로 전체 `dev --workspaces` 대신 두 터미널에서 각각 실행합니다.

`build`는 서버를 켜지 않습니다. 개발 서버를 종료한 후 `npm run build`를 실행하고, 두 터미널에서 각각 `start:web`, `start:api`를 실행하면 빌드 결과를 확인할 수 있습니다.

## 파일 구조와 역할

5차시에 추가한 경로입니다. 아래 기존 4차시 파일 구성과 함께 사용합니다.

```text
apps/web/
├── .env.example
└── src/
    ├── components/README.md  # 여러 기능의 공통 UI
    ├── features/README.md    # 기능별 UI·타입·API 요청
    └── lib/README.md         # 공통 기술 도구
apps/api/
├── .env.example
└── src/
    ├── common/README.md      # 여러 모듈의 공통 코드
    ├── modules/README.md     # 기능별 Controller·Service·Module
    └── prisma/README.md      # 향후 NestJS와 DB 연결
docs/
├── session-05-checkpoint.md
└── superpowers/plans/2026-09-12-campus-crew-session-05-dev-environment.md
```

README는 해당 폴더의 역할과 앞으로 넣을 파일을 설명합니다. 실제 코드와 하위 폴더는 필요한 차시에 추가하며 `.gitkeep`이나 빈 Module을 만들지 않습니다.

```text
campus-crew/
├── apps/
│   ├── web/
│   │   ├── src/app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── globals.css
│   │   │   └── recruitments/page.tsx
│   │   ├── src/components/layout/
│   │   │   ├── header.tsx
│   │   │   └── container.tsx
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next-env.d.ts
│   │   ├── next.config.ts
│   │   ├── postcss.config.mjs
│   │   └── eslint.config.mjs
│   └── api/
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── app.controller.ts
│       │   └── app.service.ts
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsconfig.build.json
│       ├── nest-cli.json
│       └── eslint.config.mjs
├── docs/
│   ├── session-04-checkpoint.md
│   ├── session-05-checkpoint.md
│   ├── session-06-checkpoint.md
│   ├── session-07-checkpoint.md
│   └── superpowers/plans/
│       ├── 2026-09-11-campus-crew-session-04-bootstrap.md
│       ├── 2026-09-12-campus-crew-session-05-dev-environment.md
│       ├── 2026-09-12-campus-crew-session-06-next-app-router.md
│       └── 2026-09-12-campus-crew-session-07-layout-header.md
├── package.json
├── package-lock.json
├── .gitignore
├── .gitattributes
├── .prettierrc
├── .prettierignore
└── README.md
```

### 루트

| 파일                | 역할                                                           |
| ------------------- | -------------------------------------------------------------- |
| `package.json`      | `private: true`, workspace 목록, 앱 실행 명령과 공통 개발 도구 |
| `package-lock.json` | 두 앱을 포함한 의존성의 정확한 설치 버전; Git에 포함           |
| `.gitignore`        | 의존성, 빌드 결과, 비밀 설정, 로그 등을 Git에서 제외           |
| `.gitattributes`    | 운영체제가 달라도 텍스트 파일의 줄바꿈을 LF로 통일             |
| `.prettierrc`       | 들여쓰기, 따옴표 등 공통 포맷 규칙                             |
| `.prettierignore`   | 자동 생성 파일을 포맷 대상에서 제외                            |
| `docs/`             | 수업 계획, checkpoint 및 후속 설계 문서                        |

공통 개발 도구는 루트에, 실제 앱이 사용하는 라이브러리는 해당 앱의 `package.json`에 선언합니다. 공유 코드나 공통 설정 패키지는 아직 만들지 않습니다.

### web

| 파일                            | 역할                                                                 |
| ------------------------------- | -------------------------------------------------------------------- |
| `src/app/layout.tsx`            | Header/Container와 main/children 조립, HTML 틀, metadata, CSS import |
| `src/app/page.tsx`              | App Router의 `/` 주소에 표시할 페이지                                |
| `src/app/recruitments/page.tsx` | `/recruitments` 주소에 표시할 모집글 안내 페이지                     |
| `src/app/globals.css`           | Tailwind CSS 로딩과 전역 스타일                                      |
| `next.config.ts`                | Next.js 설정; 수업에 불필요한 AI 지침 파일 자동 생성 비활성화        |
| `next-env.d.ts`                 | Next.js가 자동 생성하는 타입 참조; 직접 수정하거나 커밋하지 않음     |
| `postcss.config.mjs`            | Tailwind CSS 4를 빌드에 연결                                         |
| `tsconfig.json`                 | web TypeScript 검사 및 `@/*` → `src/*` 경로 별칭                     |
| `eslint.config.mjs`             | Next.js/React/TypeScript용 ESLint flat config                        |
| `package.json`                  | Next.js/React 의존성, Tailwind 도구, web 명령                        |

Tailwind CSS 4는 `@import 'tailwindcss'`와 PostCSS 플러그인을 사용합니다. 기본 구성에서는 별도의 `tailwind.config.js`가 필요하지 않습니다. `next lint` 대신 ESLint 명령을 직접 사용합니다.

### api

| 파일                    | 역할                                                         |
| ----------------------- | ------------------------------------------------------------ |
| `src/main.ts`           | API 환경 파일 로딩, PORT 확인, Nest 앱 실행과 시작 실패 기록 |
| `src/app.module.ts`     | 사용할 Controller와 Service 등록                             |
| `src/app.controller.ts` | `GET /` 요청을 받고 Service 호출                             |
| `src/app.service.ts`    | 응답 데이터 생성; 후속 차시에서 업무 로직을 배울 위치        |
| `nest-cli.json`         | 소스 위치와 Nest CLI 빌드 설정                               |
| `tsconfig.json`         | api TypeScript 및 Nest decorator 설정                        |
| `tsconfig.build.json`   | 빌드에서 테스트 파일 제외                                    |
| `eslint.config.mjs`     | JavaScript/TypeScript용 ESLint flat config                   |
| `package.json`          | NestJS 런타임 의존성과 api 명령                              |

요청 흐름은 `브라우저 → Controller → Service → JSON 응답`입니다. `Module`은 이 클래스들을 Nest에 등록하고, `main.ts`는 서버를 시작합니다.

## 다음 차시를 위한 위치

- `docs/`에 요구사항, API 설계, 수업 노트를 추가합니다.
- CI를 배우는 차시에 루트 `.github/workflows/`를 생성합니다.
- 15차시 로컬 데이터베이스 설정은 루트 `compose.yaml`에 있습니다.

5차시에도 위 후속 설정들은 생성하지 않습니다. 앱 구조를 바꾸지 않고 추가할 수 있습니다. Next.js 내부의 기본 번들러인 Turbopack과 별개로, monorepo 실행 도구인 Turborepo/Nx는 사용하지 않습니다.

## ESLint와 Prettier 규칙

- ESLint: web은 기존 Next.js Core Web Vitals·TypeScript 규칙, api는 기존 JavaScript·TypeScript recommended 규칙을 사용합니다. 두 앱 모두 경고도 실패로 처리하며 lint는 파일을 수정하지 않습니다.
- Prettier: 루트 `.prettierrc` 하나로 작은따옴표, 세미콜론, 공백 2칸, 후행 쉼표, LF 줄바꿈을 통일합니다. `.gitattributes`도 LF를 지정합니다.
- `eslint-config-prettier`를 각 앱 규칙 뒤에 배치해 포맷 규칙의 충돌을 막습니다. Prettier를 ESLint 안에서 중복 실행하지 않습니다.
- `.prettierignore`는 의존성·생성물·lockfile·환경 파일을 제외합니다. 비밀 파일의 Git 제외는 별도로 `.gitignore`가 담당합니다.

작업 후 `npm run check`를 실행합니다. 포맷 검사만 실패하면 `npm run format` 후 다시 검사합니다. 자동 정리로 바뀐 내용도 `git diff`로 읽고 커밋합니다.

## 환경 변수 실습

앱 환경 파일은 **앱 루트**에 둡니다. 15차시부터 저장소 루트의 `.env`는 Compose 전용으로 사용하며 앱의 환경 파일과 구분합니다.

| 앱  | Git에 공유하는 예제     | 개인 실행 파일        | 예제 값                                          |
| --- | ----------------------- | --------------------- | ------------------------------------------------ |
| web | `apps/web/.env.example` | `apps/web/.env.local` | `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` |
| api | `apps/api/.env.example` | `apps/api/.env`       | `PORT=4000`                                      |

루트에서 다음을 실행합니다. 기존 개인 환경 파일이 있으면 복사하지 않고 직접 비교합니다.

PowerShell:

```powershell
if (!(Test-Path apps/web/.env.local)) { Copy-Item apps/web/.env.example apps/web/.env.local }
if (!(Test-Path apps/api/.env)) { Copy-Item apps/api/.env.example apps/api/.env }
```

macOS/Linux:

```bash
test -e apps/web/.env.local || cp apps/web/.env.example apps/web/.env.local
test -e apps/api/.env || cp apps/api/.env.example apps/api/.env
```

### web

Next.js가 `apps/web/.env.local`을 읽습니다. 앞으로 API 호출 코드를 작성할 때 `process.env.NEXT_PUBLIC_API_BASE_URL`로 접근합니다. 현재 페이지는 아직 API를 호출하지 않으므로 이 값만 바꿔도 화면의 동작은 달라지지 않습니다.

`NEXT_PUBLIC_` 값은 브라우저 코드에 공개되고 빌드할 때 반영됩니다. 비밀번호·DB 접속 정보·비밀 키를 넣지 않습니다. 개발 중 환경 파일을 바꾸면 서버를 다시 시작하고, 배포용 공개 값을 바꾸면 다시 빌드합니다. 상세 동작은 [Next.js 환경 변수 문서](https://nextjs.org/docs/app/guides/environment-variables)를 참고하세요.

### api

`main.ts`가 앱 루트의 `.env`를 Node.js 내장 `loadEnvFile`로 읽습니다. 추가 패키지는 필요하지 않습니다. dev와 start 모두 같은 로딩 코드를 사용합니다.

우선순위는 **이미 설정된 프로세스 환경 변수 → apps/api/.env → 기본값 4000**입니다. PORT는 1~65535 정수여야 하며 잘못된 값이면 서버를 시작하지 않습니다. 환경 파일이 없으면 기본값으로 실행합니다. `.env.local` 등 다른 파일은 API에서 자동으로 읽지 않습니다.

`apps/api/.env`의 PORT를 사용하지 않는 포트(예: 4100)로 바꾸고 서버를 다시 시작한 뒤 해당 주소에서 응답을 확인합니다. 실습 후 4000으로 되돌립니다. API 포트를 바꾸면 향후 web API 주소도 맞춰야 합니다. 환경 파일 변경을 Nest watch가 자동 반영한다고 가정하지 말고 서버를 종료한 뒤 다시 실행하세요.

기존 터미널의 PORT가 파일보다 우선합니다. 설정을 확인할 때는 해당 변수만 확인하며, 전체 환경 변수를 출력해 공유하지 않습니다. 내장 로더는 [Node.js 환경 변수 문서](https://nodejs.org/api/environment_variables.html)에 설명되어 있습니다.

### Git에 공유할 것

`.gitignore`의 `.env*` / `!.env.example` 규칙은 모든 깊이에 적용됩니다. 실제 환경 파일은 제외하고 예제만 커밋합니다. 예제에도 실제 비밀 값을 넣지 않습니다. 이미 Git이 추적하는 파일은 ignore만 추가해도 추적이 해제되지 않으므로 커밋 전 파일 목록을 확인합니다.

```bash
git check-ignore apps/web/.env.local apps/api/.env
git status --short
git diff
```

첫 명령은 개인 환경 파일 두 개를 출력해야 합니다. 커밋에 포함하는 환경 파일은 앱별 `.env.example` 두 개와 15차시 루트 `.env.example`뿐입니다. 루트 `.env`도 같은 ignore 규칙이 적용됩니다.

## 확인과 문제 해결

16차시 DB 실습은 [Prisma schema · Migration · Seed](session-16-prisma.md)를 참고하세요. `apps/api`에서 `npx prisma validate`, `npx prisma format`, `npx prisma migrate dev --name init`, `npx prisma generate`, `npx prisma db seed` 순으로 실행합니다. Prisma는 7.10.0으로 고정하며, 기존 NestJS API는 아직 in-memory입니다.

[4차시 checkpoint](session-04-checkpoint.md)의 실습 순서와 검증 기록을 확인하세요.

- `EADDRINUSE` 또는 포트 충돌: 자신이 실행한 서버를 해당 터미널에서 종료한 뒤 다시 실행합니다. API는 필요하면 위 환경 변수 실습에 따라 PORT를 조정합니다. 다른 사람의 프로세스를 임의로 종료하지 않습니다.
- `next`/`nest`를 찾을 수 없음: 프로젝트 루트에서 `npm ci`를 실행합니다. 전역 CLI 설치로 해결하지 않습니다.
- `start`에서 빌드 결과를 찾지 못함: 개발 서버를 종료하고 먼저 `npm run build`를 실행합니다.
- `npm --version` 자체가 실패함: 프로젝트 이전의 Node/npm 설치 문제입니다. 실행 경로를 확인하거나 Node.js를 복구합니다. 잠금 파일 삭제는 해결책이 아닙니다.

이 PC처럼 `npm --version`에서 누락된 전역 npm 경로 오류가 나지만 `C:\Program Files\nodejs`의 npm은 설치되어 있다면, 각 PowerShell 터미널에서 아래처럼 설치된 Node.js 폴더를 임시 prefix로 지정할 수 있습니다. 새 터미널에는 적용되지 않으며 전역 설정을 저장하지 않습니다.

```powershell
$env:npm_config_prefix = Split-Path (Get-Command node).Source
npm --version
```

## 의존성 관리 메모

- 루트 `overrides`는 NestJS Express 어댑터가 사용하는 `multer`를 보안 수정 버전 `2.3.0`으로 고정합니다. [해당 보안 공지](https://github.com/advisories/GHSA-wc9g-mqfw-jrwm)에 따른 조정이며, Nest가 수정 버전을 직접 포함하면 제거 여부를 검토합니다.
- ESLint 9는 [유지보수가 종료](https://eslint.org/version-support/)되어 설치 시 경고가 표시됩니다. 이 checkpoint는 Next.js ESLint 설정에 포함된 React·접근성 플러그인의 ESLint 9 호환 범위에 맞췄습니다. ESLint 10을 공식 지원하는 플러그인 조합이 준비되면 함께 갱신합니다.

## 공식 문서

- [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/)
- [Next.js App Router 설치](https://nextjs.org/docs/app/getting-started/installation)
- [Tailwind CSS의 Next.js 설정](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
- [NestJS 첫 단계](https://docs.nestjs.com/first-steps) — 공식 문서의 최신 버전과 이 checkpoint의 NestJS 11은 다를 수 있으므로 수업에서는 잠금 버전을 사용합니다.

## 21차시 — 회원가입과 비밀번호 hash

`POST /api/auth/signup`은 DTO 입력 검증 후 bcryptjs cost 10으로 비밀번호를 hash하고 User를 생성합니다. 응답에는 id/email/name/createdAt만 포함하며 중복 이메일은 409입니다.

- [21차시 수업 노트와 실제 검증 기록](session-21-signup.md)
- [21차시 보완: 회원가입 화면과 API 연결](session-21-signup-ui.md) — 원래 커밋 보존, `lesson/session-21-signup-complete` 체크포인트 제공
- [21차시 Postman 컬렉션](postman/session-21-signup.postman_collection.json)
- 로그인과 JWT는 다음 22차시에서 구현합니다.

## 22차시 — JWT HttpOnly Cookie 로그인

`POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`을 구현했습니다.
`/login` 폼과 Header가 실제 API 및 TanStack Query 인증 캐시에 연결됩니다.
API 시작 전 `apps/api/.env`에 실제 무작위 `JWT_SECRET`을 설정하세요.
기존 signup·모집글 CRUD와 DB schema는 그대로 유지합니다.

- [22차시 구현 설명·실행 방법·학생 검증·실제 검증 기록](session-22-login-jwt-cookie.md)
- [22차시 구현 계획](superpowers/plans/2026-09-19-campus-crew-session-22-login-jwt-cookie.md)
- 다음 23차시에는 현재 JWT 검증을 Guard에서 재사용하고 작성자 권한을 적용합니다.

## 23차시 — JWT Guard와 작성자 권한

모집글 POST/PATCH/DELETE는 로그인해야 사용할 수 있으며, 수정·삭제는 작성자만 가능합니다.
현재 사용자 id는 서버가 JWT와 DB로 결정합니다. 작성 요청의 `authorId`와 `DEMO_AUTHOR_ID`를 제거하고, 상세 화면은 작성자에게만 수정·삭제 UI를 표시합니다.

- [23차시 구현 설명·변경 파일·검증 결과](session-23-auth-guard-owner-authorization.md)
- [23차시 구현 계획](superpowers/plans/2026-09-19-campus-crew-session-23-auth-guard-owner-authorization.md)
- [23차시 Postman 컬렉션](postman/campus-crew-session-23.postman_collection.json)
- 다음 24차시에는 Guard와 CurrentUser를 Application 지원/취소에 재사용합니다.

## 27차시 — DTO 검증과 API 테스트

전역 ValidationPipe와 `{ statusCode, code, message }` 에러 응답을 적용했습니다.
7개 입력 DTO를 재사용하고 Jest + Supertest로 실제 Nest/PostgreSQL 동작을 검증합니다.
기존 API 회귀 테스트도 함께 유지합니다.

- [27차시 구현·DTO 규칙·에러 코드·테스트 DB·수동 검증](session-27-validation-error-api-tests.md)
- [27차시 구현 계획과 실행 기록](superpowers/plans/2026-09-23-campus-crew-session-27-validation-error-api-tests.md)
- `.env.test.example`을 `.env.test`로 복사하고 별도 로컬 `_test` DB를 준비합니다.
- `npm run test:prepare -w apps/api` → `npm test -w apps/api`
- 전체 API 회귀 검증: `npm run test:e2e -w apps/api`
- 다음 28차시에는 Playwright smoke와 GitHub Actions PR gate를 연결합니다.

## 28차시: Playwright Smoke Test + CI

[28차시 실행 및 수업 안내](session-28-playwright-ci.md)를 참고하세요. 별도 테스트 DB와 `.env.test`를 준비한 뒤 `npm run test:e2e:prepare`, `npm run build`, `npm run test:e2e` 순서로 실제 로그인 → 목록 → 상세를 검증합니다. build에 필요한 `DATABASE_URL`과 `API_ORIGIN` 설정은 안내 문서에 있습니다. GitHub Actions는 PR/main push마다 format, lint, API/web test, build, Chromium smoke를 실행합니다.

## 29차시: Neon + Render + Vercel 배포

[배포 체크리스트](deployment.md) 순서대로 **Neon DB → Render API → Vercel Web → 실제 브라우저 smoke**를 진행합니다. production migration은 `npm run db:migrate:deploy`이며 seed는 자동 실행하지 않습니다. Next same-origin `/api/*` rewrite는 server-only `API_BASE_URL`을 사용합니다. 계획과 검증 기록은 [29차시 구현 계획](superpowers/plans/2026-09-23-campus-crew-session-29-production-deploy.md)에 있습니다. 저장소 준비와 실제 계정 배포 상태는 배포 문서의 기록표에서 구분합니다.
