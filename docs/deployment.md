# 29차시 — Neon → Render → Vercel → Production Smoke

이 문서는 **28차시 코드 `dc0b061`에서 이어지는 실제 저장소 설정**입니다. 순서는 반드시 **Neon DB → migration → Render API → Vercel Web → 실제 브라우저 smoke**입니다. 빌드 성공만으로 배포 완료라고 판단하지 않습니다.

## 0. 현재 상태와 배포 전 준비

- 2026-09-24 실제 production 배포 완료. 원본 4~30차시 작업은 보존하고 독립 checkout의 `chore/finalize-production-deployment` 브랜치에서 문서를 갱신했습니다.
- 배포 소스는 `main`의 `0cd7a388114734614e6dac6b45c7a6be650a05e2`이며 [GitHub Actions CI 성공](https://github.com/camelcaramel/campus-crew/actions/runs/35868097477)을 확인했습니다.
- [학생용 Web](https://campus-crew-web.vercel.app), [Render API 목록](https://campus-crew-api.onrender.com/api/recruitments?limit=1), [실제 설정 스크린샷 안내](https://app.notion.com/p/3e5c9251793c81f5901ac6f6c188cbc0).
- Neon migration, Render Live, Vercel Ready, 실제 HTTPS cookie와 production smoke를 확인했습니다. 연결 문자열, 비밀번호, JWT, Set-Cookie 원문은 기록하지 않습니다.

### 학생 체크리스트

1. [ ] 29차시 브랜치를 GitHub에 push하고 PR을 만듭니다. 4~28차시가 아직 원격 main에 없다면 PR의 누적 변경도 확인합니다. 기존 커밋을 덮어쓰지 않습니다.
2. [ ] GitHub 저장소 → **Pull requests → 해당 PR → Checks → CI / quality**에서 성공을 확인합니다. 리뷰 후 main에 merge하고 **Actions → CI → main의 해당 SHA**도 성공인지 확인합니다.
3. [ ] Neon project/database를 만들고 pooled `DATABASE_URL`을 준비합니다.
4. [ ] 해당 DB에 `npm run db:migrate:deploy`를 실행해 성공을 확인합니다.
5. [ ] Render Web Service를 만들고 환경변수와 명령을 입력합니다.
6. [ ] Render 빌드/시작/health를 확인하고 공개 API origin을 기록합니다.
7. [ ] Vercel에 같은 GitHub 저장소를 연결하고 `apps/web`을 선택합니다.
8. [ ] Vercel에 Render origin을 `API_BASE_URL`로 입력한 뒤 배포합니다.
9. [ ] 실제 Vercel HTTPS 주소에서 아래 smoke 전 항목을 검증합니다.
10. [ ] DB·로그와 결과를 확인한 뒤 배포 완료를 선언합니다.

계정 로그인, GitHub 앱 권한 부여, 유료 플랜 선택은 사용자가 실제 계정에서 확인합니다. 이 저장소는 결제나 자동 배포를 설정하지 않습니다.

## 1. 연결 구조와 환경 분리

```text
Browser → Vercel Next.js /api/* → Next external rewrite
        → Render NestJS /api/* → PrismaPg → Neon PostgreSQL

Local: Next :3000 → Nest :4000 → local PostgreSQL
CI:    Next :3000 → Nest :4000 → disposable PostgreSQL 17 service
```

브라우저 코드는 계속 `fetch('/api/...')`를 사용합니다. Render URL을 브라우저 fetch에 넣거나 CORS를 열어서 우회하지 않습니다. backend origin은 server-only 환경변수이며 `NEXT_PUBLIC_`를 붙이지 않습니다.

| 환경       | DB                                         | 쿠키                                  | 변수 입력 위치                            |
| ---------- | ------------------------------------------ | ------------------------------------- | ----------------------------------------- |
| local      | 개발용 또는 별도 `_test` DB                | API가 production이 아니면 Secure 없음 | 루트 `.env`, API `.env`, web `.env.local` |
| CI/E2E     | loopback + 이름이 `_test`로 끝나는 전용 DB | 기존 Playwright API는 `NODE_ENV=test` | `.env.test` / GitHub workflow의 일회용 값 |
| production | Neon의 명확히 선택한 branch/database       | Secure + HttpOnly + SameSite=Lax      | Render/Vercel 환경변수 설정               |

`npm test`, `test:prepare`, `test:e2e:prepare`는 production용 명령이 아닙니다. 기존 테스트 runner는 loopback `_test` DB만 허용합니다. CI에는 Neon URL이나 production JWT를 넣지 않습니다.

## 2. Neon DB와 migration

1. [Neon Console](https://console.neon.tech)에 로그인 → **New project** → 프로젝트 이름 `campus-crew` → 사용 가능한 가까운 region을 선택합니다. 가능하면 Render와 같은 region을 사용합니다.
2. 사용할 production branch/database/role을 확인합니다. 실습용 DB와 구분하고 이름을 배포 기록에 적습니다. 기존 DB를 쓰면 먼저 백업 및 기존 schema 여부를 확인합니다.
3. 프로젝트 **Connect** → 대상 branch/database/role 선택 → **Connection pooling** 켜기 → connection string 복사. `-pooler` hostname과 SSL 관련 query(`sslmode`, `channel_binding` 등)는 Console이 제공한 그대로 보존합니다.
4. 연결값은 Render 환경변수와 migration을 실행할 터미널의 `DATABASE_URL`에만 넣습니다. 채팅, GitHub, 강의노트, `.env.example`에 실제 값을 붙여넣지 않습니다.

현재 Prisma 7 구성은 `apps/api/prisma.config.ts`의 `datasource.url`과 `PrismaPg` 모두 `DATABASE_URL`을 사용합니다. schema의 datasource에는 URL을 추가하지 않습니다. Nest는 TCP 기반 `@prisma/adapter-pg`를 사용하며 별도 Neon adapter 업그레이드가 필요하지 않습니다.

**Pooled/direct 결정:** 2026-09-24 Prisma 7.10과 실제 Neon production DB에서 pooled URL로 `prisma migrate deploy`가 성공했습니다. `_prisma_migrations`의 완료 상태도 확인했습니다. 따라서 `DIRECT_DATABASE_URL`은 추가하지 않았습니다. 다른 환경에서 pooled migration 오류가 실제 재현되면 원인을 확인하고 동일 branch/database/role의 direct URL을 migration 셸의 `DATABASE_URL`에만 임시 지정합니다. API는 pooled 연결을 유지하며 SSL 검증을 끄거나 DB를 reset하지 않습니다.

### 최초 및 schema 변경 배포마다 수동 실행

repo 루트, Node 22.17.1 이상인 22.x, npm 10에서 실행합니다. 루트 `.env`가 있어도 프로세스 환경변수가 우선합니다. Prisma CLI는 `apps/api/.env`를 자동 로드하지 않으므로 API 전용 파일에만 URL을 넣으면 CLI가 다른 DB를 볼 수 있습니다.

```sh
npm ci --include=dev
# DATABASE_URL은 현재 셸에 안전하게 설정한 뒤 실행합니다.
npm run db:migrate:deploy
```

PowerShell에서 URL을 명령 이력에 넣지 않으려면 다음처럼 입력합니다. 붙여넣는 값은 화면에 표시되지 않습니다.

```powershell
$dbInput = Read-Host '선택한 Neon DATABASE_URL' -AsSecureString
$env:DATABASE_URL = [System.Net.NetworkCredential]::new('', $dbInput).Password
try {
  npm run db:migrate:deploy
  if ($LASTEXITCODE -ne 0) { throw 'Migration failed. Render 배포를 중단하세요.' }
} finally {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Variable dbInput
}
```

- 성공 메시지와 `_prisma_migrations`의 완료 상태를 확인한 **후에만 Render를 배포**합니다. 실패 시 app start 단계로 진행하지 않습니다.
- `migrate deploy`는 커밋된 migration만 적용합니다. 현재 migration은 초기 schema 1개이며 새 schema 변경은 없습니다. 재실행 시 pending migration이 없으면 아무것도 적용하지 않습니다.
- 이미 다른 schema가 있는 DB에 초기 migration을 강제로 적용하지 않습니다. 이 수업에서는 새 빈 DB를 선택합니다.
- `migrate dev`, `migrate reset`, `db push`는 production 배포 명령으로 사용하지 않습니다.
- **production seed는 하지 않습니다.** 과거 seed의 teacher/student는 실제 로그인용 password hash가 아니며, E2E seed는 CI 전용입니다. 배포 smoke용 계정은 아래 회원가입 API로 직접 생성합니다. 추후 데모 seed가 필요하면 사용자가 명시적으로 실행하는 upsert 전용 단계로 추가합니다.

## 3. Render NestJS API

[Render Dashboard](https://dashboard.render.com) → **New + → Web Service**. 이번 공개 저장소는 **Public Git Repository**에 `https://github.com/camelcaramel/campus-crew`를 입력했습니다. 비공개 저장소라면 Git Provider에서 GitHub 저장소 접근 권한을 연결합니다. 서비스는 `campus-crew-api`, Singapore, Free입니다.

| 설정               | 이 저장소의 값                                      |
| ------------------ | --------------------------------------------------- |
| Repository         | `camelcaramel/campus-crew`                          |
| Branch             | CI green인 `main` (선택 SHA 확인)                   |
| Language / Runtime | Node                                                |
| Root Directory     | **비워 둠 = repo root**                             |
| Build Command      | `npm ci --include=dev && npm run build -w apps/api` |
| Start Command      | `npm run start -w apps/api`                         |
| Health Check Path  | `/api/recruitments?limit=1`                         |
| Node               | 22.x; package.json의 `>=22.17.1 <23` 확인           |
| Auto Deploy        | 수업 수동 migration 방식에서는 **Off**              |

repo root의 npm workspaces와 package-lock.json을 사용합니다. `apps/api`를 Render Root Directory로 선택하지 않습니다. production에서도 compiler와 Prisma CLI가 필요해 `--include=dev`로 설치합니다. API `prebuild`가 `prisma generate`를 실행하므로 별도 generate 명령은 중복입니다. 컴파일 결과 `apps/api/dist/src/main.js`를 기존 `start` script가 실행합니다. 존재하지 않는 `start:prod`를 입력하지 않습니다.

Nest는 기존 PORT 숫자 검증을 유지하고 `await app.listen(port, '0.0.0.0')`로 바인딩합니다. 로컬 기본은 4000, Render에서는 platform의 PORT를 사용합니다.

### Render 환경변수 이름

**Environment → Add Environment Variable**에서 입력합니다.

| 이름           | 설정 원칙                                                       |
| -------------- | --------------------------------------------------------------- |
| `NODE_ENV`     | `production`                                                    |
| `DATABASE_URL` | Neon pooled URL, 실제 값 비공개                                 |
| `JWT_SECRET`   | 비밀번호 관리자 등으로 새로 만든 충분히 긴 무작위 값, 최소 32자 |
| `PORT`         | Render 제공값 사용; 수동 고정 불필요                            |

repo의 Node 범위가 선택되므로 `NODE_VERSION`은 필수 변수가 아닙니다. 기존 서비스에 별도의 `NODE_VERSION` override가 있으면 지우거나 22.x 범위와 일치시킵니다. 모든 build/runtime 버전은 실제 로그에서도 확인합니다.

`JWT_SECRET`은 예제 문자열/CI용 값 재사용 금지입니다. 비밀값을 생성하거나 입력할 때 화면 공유·터미널 로그·클립보드 공유에 노출하지 않습니다. Vercel에는 이 값을 넣지 않습니다.

### Migration과 배포 시점

- 현재 **Free 플랜은 pre-deploy를 제공하지 않아 수동 migration**을 사용합니다. 위 2단계 성공 → Render **Deploy Web Service** 또는 **Manual Deploy → Deploy latest commit** 순서입니다. 이후 schema 변경도 동일합니다. Auto Deploy는 Off입니다.
- 현재 Render 문서상 pre-deploy는 paid web service에서 제공합니다. 실제 계정에 해당 기능이 있는 경우 **Settings → Build & Deploy → Pre-Deploy Command**에 `npm run db:migrate:deploy`를 설정할 수 있습니다. 성공 후에만 start가 진행됩니다. 최초 Neon migration을 생략하지 않고 이후 배포에 적용합니다.
- migration을 build나 start에 몰래 끼워 넣지 않습니다. production seed도 연결하지 않습니다.
- Free instance를 사용하면 idle 이후 cold start가 발생할 수 있습니다. 수업 데모와 실제 운영 가용성은 구분하며, 임의로 유료 플랜을 선택하지 않습니다.

배포 후 **Logs**에서 Nest 시작과 DB 연결 오류 유무, **Events**에서 deploy 결과를 확인합니다. public origin의 `/api/recruitments?limit=1`이 JSON 200이어야 합니다. 빈 DB의 `items: []`는 정상입니다. 이 health endpoint는 실제 DB 조회까지 검증합니다. 추가 health subsystem은 만들지 않습니다.

Render API origin을 확보한 뒤에만 다음 단계로 이동합니다. API의 `/docs`로 요청 구조를 볼 수 있지만 production 비밀번호/JWT를 공유 화면에 넣지 않습니다.

## 4. Vercel Next.js Web

[Vercel Dashboard](https://vercel.com/dashboard) → **Add New… → Project → Import Git Repository → Campus Crew Import**.

| 설정                                                                 | 이 저장소의 값                        |
| -------------------------------------------------------------------- | ------------------------------------- |
| Framework Preset                                                     | Next.js                               |
| Root Directory                                                       | `apps/web`                            |
| Include source files outside of the Root Directory in the Build Step | 켜기 (루트 workspace/lockfile 접근)   |
| Install Command (Override)                                           | `cd ../.. && npm ci --include=dev`    |
| Build Command                                                        | `npm run build` (`apps/web`에서 실행) |
| Output Directory                                                     | Next.js 기본값 `.next` 유지           |
| Node.js Version                                                      | **22.x**                              |
| Production Branch                                                    | CI green인 `main`                     |

루트의 전체 `npm run build`를 Vercel에 설정하지 않습니다. 그것은 API Prisma generate까지 실행해서 불필요하게 DATABASE_URL을 요구합니다. 위 설정은 루트에서 의존성만 설치하고 web만 빌드합니다. Vercel install 로그가 repository root lockfile을 쓰는지 확인합니다. package.json의 Node 범위와 대시보드 Node 22.x를 맞춥니다.

**Environment Variables**:

- 이름: `API_BASE_URL`
- 값: 앞 단계에서 확인한 Render의 **HTTPS origin**. `/api` suffix 없이 입력합니다.
- Scope: Production. Preview도 시험할 경우 별도로 적절한 backend를 지정합니다. production DB를 사용하는 Preview는 실제 데이터를 변경하므로 수업 smoke 외 목적으로 연결하지 않습니다.
- `NEXT_PUBLIC_API_BASE_URL`, `DATABASE_URL`, `JWT_SECRET`, Render/Vercel token은 web에 넣지 않습니다.

이후 **Deploy** → 빌드 성공 → 생성된 production URL을 엽니다. 이후 환경변수 수정은 **Project → Settings → Environment Variables**에서 저장한 뒤 **Deployments → Redeploy**로 반영합니다.

### Next proxy 동작

`apps/web/next.config.ts`의 공식 external rewrite를 유지합니다.

```text
/api/:path* → API_BASE_URL + /api/:path*
```

- build-time 설정입니다. 빌드 결과 `.next/routes-manifest.json`에 목적지가 들어갑니다. 환경변수만 바꾸고 기존 배포를 그대로 두면 목적지가 바뀌지 않습니다.
- 개발 모드 우선순위: `API_BASE_URL` → 과거 차시의 `API_ORIGIN` → `http://localhost:4000`. 30차시부터 로컬을 포함한 production build는 명시적인 `API_BASE_URL`이 필수입니다. [장애 재현·복구 기록](incident-30.md)을 참고하세요.
- Vercel에서는 `API_BASE_URL` 누락 시 빌드를 실패시킵니다. HTTPS가 아니거나 명백한 loopback 주소, credentials/query/path가 들어간 origin도 거부합니다.
- browser Network의 요청 대상은 Vercel `/api/*`입니다. 별도 redirect나 브라우저의 Render 직접 호출이 아닙니다. origin은 브라우저 비밀값으로 간주하지 않지만 client 환경변수로 공급할 필요가 없습니다.
- 기존 Nest 쿠키에는 Domain이 없습니다. 프록시 응답의 쿠키는 사용자가 요청한 Vercel host에 저장되어야 합니다. Route Handler proxy는 추가하지 않았으며 Set-Cookie forwarding은 smoke로 검증합니다.

## 5. 실제 HTTPS Production smoke

**Vercel production URL**을 사용하고 DevTools → Network / Application → Cookies를 엽니다. 쿠키 **값**을 복사하거나 전체 HAR/trace를 공유하지 말고 이름·옵션·상태 코드만 기록합니다. 기존 session-28 Playwright는 로컬 서버와 테스트 DB를 기동하므로 hosted 검증을 대신하지 않습니다.

21차시 화면 보완 이후에는 **Vercel의 `/signup` 화면**에서 이름·이메일·비밀번호·비밀번호 확인을 입력해 계정 A/B를 만듭니다. 가입 201과 완료 안내를 확인한 뒤 `/login`으로 이동해 로그인합니다. 가입 자체는 JWT나 Cookie를 만들지 않습니다. Postman의 `POST /api/auth/signup`도 계속 사용할 수 있습니다. 비밀번호와 Cookie 값은 로그·강의노트에 기록하지 않으며 API origin을 Render로 바꾸지 않습니다.

| 순서 | 행동                                                               | 기대 결과                                                                   |
| ---- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| 1    | `/`, `/login`, `/recruitments` 열기                                | 페이지 로드; 비로그인 `/api/auth/me` 401은 정상                             |
| 2    | 위 회원가입 API로 smoke 계정 A 생성 또는 기존 데모 계정 사용       | signup 201; 실사용 비밀번호 재사용 금지                                     |
| 3    | `/login`에서 A 로그인                                              | `/api/auth/login` 200; Set-Cookie 수신                                      |
| 4    | Application의 Vercel host 쿠키 확인                                | `access_token`; HttpOnly, Secure, SameSite=Lax, Path=/; Render Domain 없음  |
| 5    | 새로고침                                                           | 같은 origin `/api/auth/me` 200, 로그인 Header 유지; JS에서 토큰을 읽지 않음 |
| 6    | 목록 조회                                                          | `/api/recruitments` 200; 빈 DB라면 empty state                              |
| 7    | `/recruitments/new`에서 `[29차시 smoke 날짜]`로 시작하는 글 생성   | POST 201, 실제 로그인 A가 author                                            |
| 8    | 목록/검색에서 새 글 확인 후 클릭                                   | 목록에 반영; `/recruitments/:id`와 상세 API 200                             |
| 9    | 별도 브라우저 프로필/시크릿 창에 B 가입·로그인, A의 OPEN 글에 지원 | 지원 201 → PENDING 표시                                                     |
| 10   | B의 지원 취소                                                      | DELETE 204; 다시 지원 폼 표시                                               |
| 11   | A/B 로그아웃                                                       | logout 200, 동일 옵션으로 Cookie 만료; `/api/auth/me` 401                   |

Network에서 어느 요청도 Render origin을 직접 향하지 않아야 합니다. 로그인/새로고침/로그아웃의 `/api/auth/*`에 `Cache-Control: no-store`가 유지되는지도 확인합니다.

### DB와 로그 확인

Neon project → **SQL Editor** → 동일 production branch/database를 선택합니다. 비밀번호 hash를 조회하지 않고 smoke 제목으로 행을 한정합니다.

```sql
SELECT id, name, "createdAt"
FROM users WHERE name LIKE '29차시 smoke%';

SELECT id, title, "authorId", "createdAt"
FROM recruitments WHERE title LIKE '[29차시 smoke%';

SELECT a.id, a.status, a."applicantId", a."recruitmentId"
FROM applications a JOIN recruitments r ON r.id = a."recruitmentId"
WHERE r.title LIKE '[29차시 smoke%';

SELECT migration_name, finished_at, rolled_back_at
FROM _prisma_migrations ORDER BY started_at;
```

- Render → Service → Logs: Nest start 확인, Prisma 연결/미적용 migration 오류 없음.
- Vercel → Project → Deployments → 해당 배포 → Build Logs; Project Logs/Runtime Logs 및 browser Network에서 proxy 5xx 없음. rewrite 요청이 runtime log에 보이지 않더라도 Network 결과를 함께 확인합니다.
- 지원 취소 후 해당 application 행이 사라지는 것은 정상입니다. 필요하면 취소 전후를 각각 확인합니다.
- smoke 데이터를 남기면 테스트용 계정 A/B와 해당 recruitment ID를 기록합니다. 정리는 B의 지원 취소 후 A가 **본인이 방금 만든 smoke 글만** 삭제합니다. 다른 사용자 글이나 전체 테이블을 지우지 않습니다. 계정 삭제 UI는 없으므로 데모 계정은 테스트 표시한 채 남기고 임의의 SQL 대량 삭제는 하지 않습니다.

### 배포 기록표 (2026-09-24 실제 실행)

| 항목                            | 현재 기록                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| GitHub CI / 배포 SHA            | CI success / `0cd7a38`                                                                                             |
| Neon project/branch/DB          | `campus-crew-production` (`dry-river-47252168`) / `production` / `neondb`, AWS Singapore Free                      |
| Neon migration                  | pooled 연결로 `20260919105521_init` 적용 완료, rollback 없음                                                       |
| Render API URL / plan / deploy  | https://campus-crew-api.onrender.com / Free / `dep-daqhu417lnhs73d2nte0`, Live                                     |
| Vercel Web URL / deploy         | https://campus-crew-web.vercel.app / `dpl_6YcNfQpBYouc8Dph25UYWsBAQX3h`, Ready                                     |
| HTTPS cookie / production smoke | Secure, HttpOnly, SameSite=Lax, Vercel host / 로그인·새로고침 me 200·로그아웃 me 401·작성·목록·상세·지원·승인 확인 |
| production 테스트 데이터        | 교사·학생 데모 계정 2개, 모집글 ID 1, 승인된 지원 ID 1 보존                                                        |

Vercel 최초 빌드는 기본 설치 방식에서 루트 개발 의존성 `@types/node`가 빠져 실패했습니다. 위 Install Command override를 설정하고 Node 22.x로 재배포하여 성공했습니다. Render 환경변수는 `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, Vercel Production 변수는 `API_BASE_URL`만 설정했습니다.

데모 계정은 `teacher-demo@example.com`, `student-demo@example.com`이며 비밀번호는 별도 비공개 관리합니다. 모집글은 “Campus Crew 첫 수업 — 함께 만드는 풀스택 프로젝트”입니다. 회원가입 API와 정상 UI/API 흐름으로 만들었으며 production seed, reset, 데이터 삭제는 실행하지 않았습니다. 이번 hosted 검증은 지원 후 승인 흐름으로 마쳤고 지원 취소는 실행하지 않았습니다. 브라우저가 보낸 API 요청 26개 모두 Vercel origin을 사용했습니다.

## 6. 흔한 문제 해결

| 증상                            | 확인 및 조치                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Render가 port를 감지하지 못함   | NODE/PORT 로그, `process.env.PORT`, `0.0.0.0` 바인딩 확인                                                              |
| Prisma Client/module not found  | repo root `npm ci --include=dev`, API prebuild generate와 `dist/src/main.js` 확인                                      |
| relation/table does not exist   | 선택한 DB/branch와 `migrate deploy` 성공 확인; reset 금지                                                              |
| Vercel이 localhost로 proxy      | Production API_BASE_URL 입력, 재빌드/재배포, routes manifest 확인                                                      |
| 로그인 직후 다시 비로그인       | same-origin 요청, Set-Cookie, Vercel host 저장, Secure/Lax/HttpOnly/Path, 재요청 Cookie 확인                           |
| Neon 연결 실패                  | 정확한 database/role, Console URL/SSL query, project 활성 상태 확인; pool 문제를 확인했을 때만 migration용 direct 사용 |
| CORS 오류                       | 프론트가 Render를 직접 호출하는지 확인하고 `/api/*`로 복원                                                             |
| Node/npm 버전 차이              | 루트와 web engines, Render override, Vercel Node 22.x, CI setup-node 22 일치                                           |
| migration 실패                  | 배포 중단, 로그에서 원인 해결 후 재시도; DB 초기화로 회피 금지                                                         |
| Vercel Prisma DATABASE_URL 오류 | Build가 API까지 빌드하는지 확인; web root의 `npm run build`로 수정                                                     |
| Render 첫 요청 지연             | 선택 플랜의 cold start 확인; API 정상 응답 후 web smoke 재시도                                                         |

## 7. 로컬 재현과 수업 연결

별도 `_test` DB와 `.env.test`를 준비합니다. 기존 28차시 [실행 안내](session-28-playwright-ci.md)를 사용하되 이번 예제의 변수 이름은 `API_BASE_URL`입니다. `.env.test`는 Next build가 자동 로드하지 않으므로 build 셸에도 API_BASE_URL과 **테스트 DB**의 DATABASE_URL을 명시해야 합니다.

```sh
npm ci --include=dev
npm run format:check
npm run lint
npm run test:e2e:prepare
npm test
# 셸에 테스트 DATABASE_URL과 API_BASE_URL=http://127.0.0.1:4000 설정 후:
npm run build
npm run test:e2e
```

생산 모드 API 검증에서는 `NODE_ENV=production`을 사용해 Secure 쿠키를 확인합니다. **loopback HTTP의 Chromium Secure-cookie 예외 통과는 실제 Vercel HTTPS 검증과 다릅니다.** hosted 체크리스트를 반드시 별도로 수행합니다.

학습 포인트: local/CI/production 분리, DB/API/Web의 연결, secret 외부 주입, migrate dev와 deploy의 차이, platform PORT, reverse proxy, HTTPS 쿠키, CI green → deploy → browser verify입니다. 다음 30차시는 **production incident 재현 → 원인 확인 → fix 브랜치/PR → CI green → migration 필요 여부 확인 → redeploy → 같은 smoke → v1.0**으로 이어갑니다. 의도적인 장애 실습은 사용자 데이터가 없는 별도 데모 환경에서 진행합니다.

## 8. 29차시 당시의 로컬 검증 기록

- Node 22.17.1 / npm 10.9.2, 원본 lockfile 의존성 유지. `npm ci --include=dev` 성공.
- `format:check`, `lint`, API 63개 + web 80개 테스트 통과. web에는 실제 Next config를 실행하는 배포 설정 회귀 테스트 9개가 포함됩니다.
- API prebuild의 Prisma generate, compiled start, web production build 확인. Vercel의 `apps/web` 기준 루트 설치와 web-only 빌드는 DATABASE_URL 없이 성공했습니다.
- 로컬 전용 `campus_crew_session29_test` DB에 초기 migration 적용 및 `db:migrate:deploy` 재실행 성공. 기존 수업 DB는 수정하지 않았습니다.
- Render와 같은 `PORT=10000`으로 compiled API를 실행해 `0.0.0.0` listen과 DB를 조회하는 health 200을 확인했습니다.
- 기존 Playwright 로그인 → 목록 → 상세 smoke 통과.
- 추가 실제 Chromium production 모드 검증: 홈, same-origin API 회원가입, UI 로그인, Set-Cookie의 Secure/HttpOnly/Lax와 Domain 미지정, 브라우저 저장, JS 접근 불가, 새로고침/me 200, UI 글 생성·검색 목록·상세, 두 번째 계정 지원/PENDING DB 조회/취소, 로그아웃/me 401 통과. 모든 브라우저 요청은 Next origin을 유지했습니다.
- 추가 smoke가 만든 로컬 계정/모집글/지원 행은 해당 ID만 정리하고 테스트 서버를 종료했습니다. 로컬 `_test` DB와 기존 E2E fixture는 재검증용으로 남았습니다.
- **이 절은 29차시 당시의 loopback HTTP 검증 기록입니다.** 이후 2026-09-24 실제 hosted 배포와 HTTPS 검증을 완료했으며 최신 결과는 위 배포 기록표를 참고하세요.

변경 파일: `package.json`, `package-lock.json`, `apps/api/package.json`, `apps/web/package.json`, `apps/api/src/main.ts`, `apps/web/next.config.ts`, `apps/web/test/deployment-config.test.mjs`, `.env.example`, `.env.test.example`, `apps/api/.env.example`, `apps/web/.env.example`, `.github/workflows/ci.yml`, `README.md`, 이 문서, 29차시 계획 문서. migration/seed와 기존 기능 소스는 변경하지 않았습니다.

의존성 참고: 이번 설치에서 `npm audit --omit=dev`는 기존 Prisma CLI 전이 의존성(`deepmerge-ts`, `mysql2` 및 이를 포함하는 Prisma/config)에 high 4개를 보고했습니다. 이 앱의 DB adapter는 PostgreSQL이며 해당 CLI 의존성을 통한 실제 노출 가능성은 별도 평가가 필요합니다. npm이 제안한 자동 fix는 Prisma 6으로 변경하는 major 작업이므로 실행하지 않았습니다. 이번 차시의 프레임워크 변경 금지 범위를 유지하고 후속 의존성 검토 대상으로 기록합니다.

## 9. 2026-09-24 최종 검증

- format:check, lint, API 63개, web 83개 테스트, API/Web build, 로컬 Playwright 1개 통과.
- 로컬 검증은 별도 `campus_crew_deploy_20260924_test` DB를 사용했습니다. API 테스트 첫 통합 실행의 서버 시작 실패 후 단독 재실행에서 4개 suite/63개 모두 통과했습니다.
- 실제 Vercel HTTPS에서 UI 로그인·모집글 작성·목록·상세·학생 지원, API 승인 후 UI의 `승인됨 (APPROVED)` 표시, 로그아웃을 확인했습니다.
- 스크린샷과 smoke 기록에는 쿠키 값·JWT·연결 문자열·비밀번호를 포함하지 않았습니다.
- Render Free는 유휴 후 첫 요청이 지연될 수 있으므로 수업 전에 Web/API를 열어 정상 응답을 확인하세요. 남은 필수 로그인 승인이나 배포 설정은 없습니다.

## 공식 근거 (2026-09-23~24 확인)

- [Neon: Prisma pooled migration 지원](https://neon.com/blog/better-postgres-with-prisma-experience), [현재 Prisma 연결 가이드](https://neon.com/docs/guides/prisma) — 두 자료의 pooled/direct 안내 차이를 위에 명시했습니다.
- [Render Web Services: host와 PORT](https://render.com/docs/web-services), [배포 단계 및 paid pre-deploy](https://render.com/docs/deploys), [Node 버전](https://render.com/docs/node-version).
- [Vercel monorepos](https://vercel.com/docs/monorepos), [root 외 파일 접근](https://vercel.com/docs/monorepos/monorepo-faq), [Node 버전](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
- [Next 공식 external rewrite](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites).
