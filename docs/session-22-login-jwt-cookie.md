# 22차시 — 로그인, JWT, HttpOnly Cookie

## 이번 차시 결과

21차시 회원가입 사용자가 이메일/비밀번호로 로그인하면 서버가 JWT를 Cookie에 저장합니다. 새로고침 후에도 `GET /api/auth/me`가 JWT를 검증하고 DB에서 현재 사용자를 조회합니다. Header에서 로그아웃하면 Cookie를 제거하고 로그인 링크로 돌아갑니다.

기준은 `dfb5e28`(21차시)이며, 별도 `feat/session-22-login-jwt-cookie` 브랜치/worktree에서 구현했습니다. 기존 4~21차시 커밋·worktree와 회원가입/모집글 CRUD를 보존했습니다. Prisma schema 변경과 migration은 없습니다.

현재 저장소에는 F01에 해당하는 `/login` 소스나 Figma URL이 없었습니다. 공통 Header/Container/색상/입력 스타일을 재사용해 로그인 화면을 추가했습니다. 원본 Figma와 픽셀 단위 일치를 검증한 결과는 아닙니다.

## API 계약

| Method | Endpoint         | 성공                        | 실패                                                 |
| ------ | ---------------- | --------------------------- | ---------------------------------------------------- |
| POST   | /api/auth/login  | 200, 공개 user + Set-Cookie | 입력 오류 400, 자격 증명 오류 401                    |
| GET    | /api/auth/me     | 200, 공개 user              | token 없음/위조/만료/잘못된 claims/삭제된 사용자 401 |
| POST   | /api/auth/logout | 200, 메시지 + Cookie 만료   | 이미 로그아웃한 상태도 200                           |

로그인 요청:

```json
{ "email": "student@example.com", "password": "password123" }
```

login과 me의 성공 응답:

```json
{ "user": { "id": 1, "name": "김학생", "email": "student@example.com" } }
```

잘못된 이메일과 비밀번호는 모두 같은 응답입니다. 어떤 항목이 틀렸는지 알려주지 않습니다.

```json
{
  "statusCode": 401,
  "code": "AUTH_INVALID_CREDENTIALS",
  "message": "이메일 또는 비밀번호를 확인해주세요."
}
```

logout 응답은 `{ "message": "로그아웃되었습니다." }`입니다. JWT, password, passwordHash는 성공 응답에 포함하지 않습니다. 사용자는 필드를 명시한 Prisma select와 공개 DTO로 제한합니다.

`LoginDto`는 `PickType(SignupDto, ['email', 'password'])`를 사용합니다. 이메일과 비밀번호 8~50자, 올바른 Unicode, bcrypt의 UTF-8 72바이트 제한을 21차시와 동일하게 유지합니다.

## JWT와 Cookie 설정

| 항목           | 값                                             |
| -------------- | ---------------------------------------------- |
| Cookie 이름    | access_token                                   |
| httpOnly       | true                                           |
| sameSite       | lax                                            |
| secure         | NODE_ENV === 'production'                      |
| path           | /                                              |
| Cookie maxAge  | 3,600,000ms (1시간)                            |
| JWT 만료       | 3,600초 (1시간)                                |
| JWT 알고리즘   | HS256 (발급/검증 모두 제한)                    |
| JWT payload    | sub: user.id, email: user.email + 표준 iat/exp |
| Secret         | JWT_SECRET 환경변수                            |
| 인증 응답 캐시 | Cache-Control: no-store                        |

`authJwtOptions()`는 secret 누락, 32자 미만, example placeholder를 거부합니다. `JwtModule.registerAsync`의 factory를 사용하므로 기존 main.ts가 .env를 로딩한 뒤 환경값을 읽습니다. 우선순위는 프로세스 환경변수 → apps/api/.env → 루트 .env입니다.

학습용 실제 비밀값도 Git에 넣지 않습니다. 다음 명령으로 무작위 값을 생성하고 본인의 `apps/api/.env`에 `JWT_SECRET=생성값`을 적습니다. 운영에서는 별도의 충분히 긴 무작위 secret을 배포 환경에서 주입합니다.

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

`apps/api/.env.example`에는 실제로 사용할 수 없는 placeholder만 있습니다. 실제 .env는 ignored 상태입니다.

## 학생에게 설명할 핵심

1. **hash와 compare:** 가입할 때 hash를 저장합니다. 로그인할 때는 `bcryptjs.compare(입력값, 저장된 hash)`로 검증합니다. hash를 복호화하지 않습니다.
2. **JWT:** 서버가 서명을 확인할 수 있는 토큰입니다. payload는 암호화된 비밀 저장소가 아니므로 비밀번호/민감정보를 넣지 않습니다.
3. **HttpOnly:** JavaScript의 `document.cookie`에서 인증 Cookie를 직접 읽지 못합니다. 브라우저의 HTTP 요청에는 Cookie가 자동으로 붙습니다.
4. **SameSite=Lax:** 다른 사이트에서 시작한 일반적인 cross-site fetch/POST에는 Cookie 전송을 제한합니다. 최상위 페이지의 안전한 GET 이동 등은 허용하므로 완전한 CSRF 방어와 같지는 않습니다.
5. **Secure:** 운영 HTTPS에서만 Cookie가 전송되도록 합니다. 로컬 HTTP 개발에서는 false입니다.
6. **저장과 인증의 차이:** Cookie가 있다는 사실만으로 인증하지 않습니다. 서버가 서명/만료/claims를 verify하고 현재 DB 사용자가 존재하는지 확인해야 합니다.
7. **me:** 현재 인증 상태와 공개 사용자 정보를 확인하는 endpoint입니다. 프론트는 401만 정상적인 비로그인(null)으로 처리하고 서버 장애는 오류로 표시합니다.
8. **logout:** 동일한 이름/path/options로 Cookie를 만료시킵니다. clearCookie에는 발급 시 maxAge를 넣지 않습니다.
9. **stateless 한계:** logout은 브라우저의 Cookie를 지웁니다. 별도로 복사된 JWT 자체를 서버에서 폐기하는 기능은 없으며, 해당 JWT는 만료까지 유효할 수 있습니다.
10. **Header와 권한:** 로그인 UI는 서버의 접근 권한 검사와 다릅니다. 모집글 쓰기 권한은 다음 23차시에서 다룹니다.

## 프론트 연결

`features/auth/api.ts`는 `login(values)`, `getMe(signal?)`, `logout()`을 제공합니다. 모든 호출은 `/api/auth/*` 상대 경로입니다. 브라우저는 Next와 같은 origin으로 요청하고 기존 rewrite가 Nest로 전달합니다. fetch의 기본 `credentials: 'same-origin'`으로 충분하므로 cross-origin CORS 호출이나 별도 credentials 설정을 추가하지 않았습니다.

`features/auth/queries.ts`의 `authMeKey = ['auth', 'me']`와 `useMeQuery()`가 Header를 구동합니다. `useLoginMutation()` 성공 시 진행 중인 me 요청을 취소하고 공개 user를 캐시에 저장합니다. 폼은 성공 후 `/recruitments`로 이동합니다. `useLogoutMutation()`은 서버의 Cookie 제거가 성공하면 진행 중인 me 요청을 취소하고 캐시를 null로 바꿉니다. queryFn은 AbortSignal을 fetch로 넘겨 오래된 응답이 새 인증 상태를 덮어쓰지 않도록 합니다.

`LoginForm`은 기존 RHF + Zod 패턴을 사용하며 label, 필드 오류, 일반적인 서버 오류, pending 버튼을 제공합니다. Header는 초기 확인 중/로그인/비로그인/조회 실패 재시도를 구분합니다. 원래 22차시에는 회원가입 화면을 후속 범위로 남겨두었지만, 현재 통합본에는 [21차시 화면 보완](session-21-signup-ui.md)이 반영되어 로그인 화면에서도 회원가입으로 이동할 수 있습니다.

## 실행 및 학생 검증

새 환경에서는 기존 수업 순서대로 DB를 준비합니다. 기존 DB가 실행 중이면 같은 PostgreSQL을 사용하고 재초기화하지 않습니다.

```sh
npm ci
# 루트 .env.example → .env: 로컬 PostgreSQL 값 설정
# apps/api/.env.example → apps/api/.env: JWT_SECRET 실제 무작위 값 설정
docker compose up -d postgres
npm run db:migrate --workspace=@campus-crew/api
# 새 실습 DB일 때만 기존 seed 절차 사용
npm run dev:api
# 별도 터미널
npm run dev:web
```

1. `http://localhost:3000/login`에 접속합니다.
2. 21차시 가입 사용자를 사용합니다. 초기 seed의 passwordHash는 placeholder이므로 로그인할 수 없습니다. 필요하면 Swagger `http://localhost:4000/docs`에서 `POST /api/auth/signup`으로 실습 사용자를 만듭니다.
3. 잘못된 비밀번호로 로그인합니다. Network의 login 응답은 401이고 화면에는 일반적인 안내가 표시됩니다.
4. 올바른 비밀번호로 로그인합니다. 200, `{ user }`, 모집글 이동, Header 사용자 이름을 확인합니다.
5. DevTools Application/Storage → Cookies → 현재 origin에서 `access_token`, HttpOnly, SameSite=Lax, Path=/, 만료 시간을 확인합니다. 로컬 HTTP에서는 Secure가 false입니다.
6. Console에서 `document.cookie`에 access_token이 안 보이는 것은 정상입니다. HttpOnly Cookie이기 때문입니다.
7. Network에서 login의 응답 Set-Cookie와 이후 me 요청의 Cookie 흐름을 확인합니다. token 값은 복사하여 공개하지 않습니다.
8. 새로고침 후 Header 사용자 이름과 me 200을 확인합니다.
9. Header 로그아웃을 누릅니다. logout 200과 과거 날짜로 만료시키는 Set-Cookie를 확인합니다.
10. 다시 새로고침하면 me 401과 로그인 링크가 표시됩니다.
11. signup/login/me 및 모집글 응답 어디에도 passwordHash가 노출되지 않는지 확인합니다.
12. 운영 HTTPS에서는 `NODE_ENV=production`으로 실행하고 Secure를 확인합니다.

기존 3000/4000 서버와 동시에 실습할 경우 Next의 **서버 전용** `API_ORIGIN=http://localhost:4022`를 dev/build 전에 지정할 수 있습니다. 기본값은 기존 4000입니다. rewrite는 build 시 결정되므로 목적지를 바꾼 뒤에는 다시 빌드해야 합니다. 브라우저는 어떤 경우에도 현재 웹 origin의 /api를 호출합니다.

이번 검증에서는 기존 서버를 보존하기 위해 API 4022, web 3022를 사용했습니다.

## 설치 패키지와 변경 파일

추가한 직접 의존성은 `@nestjs/jwt@11.0.2`, `cookie-parser@1.4.7`, 개발 타입 `@types/cookie-parser@1.4.10`, `@types/express@5.0.6`입니다. 기존 Nest 11.2.3, bcryptjs 3.0.3, Prisma/Next/React 버전은 유지했습니다.

| 범위          | 파일                                                                            |
| ------------- | ------------------------------------------------------------------------------- |
| API 기존 확장 | auth.controller.ts, auth.service.ts, auth.module.ts, main.ts                    |
| API 추가      | auth-config.ts, auth-cookie.ts, auth-response.dto.ts, login.dto.ts              |
| API 설정/시험 | apps/api/.env.example, package.json, test/auth.e2e.mjs                          |
| 프론트 추가   | app/login/page.tsx, features/auth/api.ts, queries.ts, schema.ts, login-form.tsx |
| 프론트 연결   | components/layout/header.tsx, next.config.ts, apps/web/.env.example             |
| 프론트 시험   | apps/web/test/auth.test.mjs                                                     |
| 공통/문서     | package-lock.json, README.md, 이번 계획서와 이 문서                             |

## 실제 검증 기록 — 2026-09-19

- 기준선: 기존 API e2e 19/19, web 20/20.
- 새 테스트 먼저 실행: API 인증 7개는 기존 라우트 부재(404)로 실패했고 프론트 4개도 구현 전 실패함을 확인했습니다.
- 구현 후 전체 API e2e 27/27: 가입/기존 모집글 CRUD 회귀, 잘못된 credentials, DTO 경계, JWT payload/만료/위조/알고리즘/삭제 사용자, 쿠키/로그아웃/production Secure 통과.
- web 25/25: 기존 테스트 + 가입 시 허용된 Unicode/quoted 이메일 호환성 + auth API 경계/401과 장애 구분/AbortSignal 전달/일반 오류/로그인 schema 통과.
- 전체 format:check, lint, build 및 Prisma db:typecheck 통과.
- 실제 브라우저: 잘못된 비밀번호 오류, 로그인 후 모집글 이동, 사용자 이름 표시, 새로고침 유지, Header 로그아웃 후 로그인 링크 및 재새로고침 확인.
- 실제 Next 프록시 HTTP: login 200 → me 200 → logout 200 → me 401. login/me는 id/name/email만 반환. Cookie jar와 Set-Cookie에서 HttpOnly=true, Secure=false(로컬), Path=/, SameSite=Lax, Max-Age=3600 확인. logout은 같은 이름/path로 1970년 만료 Cookie 반환.
- production 옵션은 실제 Nest 서버를 NODE_ENV=production으로 시작하는 e2e에서 login/logout의 Secure 헤더를 검증했습니다. 배포된 HTTPS 환경에서의 브라우저 검증은 이번 로컬 검증에 포함되지 않습니다.
- 브라우저 도구는 DevTools Storage/Network 및 document.cookie 직접 조회를 제공하지 않아 해당 패널을 눈으로 확인했다고 주장하지 않습니다. 플래그와 요청 왕복은 위 HTTP 테스트로 확인했으며, 학생이 직접 패널을 확인하는 방법은 위에 설명했습니다.

## 23차시로 연결

`AuthService.authenticate(token)`는 Cookie를 읽는 HTTP 처리와 분리되어 있습니다. 23차시에는 작은 AuthGuard가 이 함수를 호출하여 `request.user`에 공개 사용자를 넣고, 모집글 쓰기 endpoint에 Guard를 적용합니다. 생성자는 body의 임시 authorId 대신 로그인 사용자의 id로 정하고, 수정/삭제는 DB의 authorId와 인증 사용자 id를 비교합니다. 인증 실패 401과 권한 부족 403을 구분합니다.

Refresh token, OAuth, role, owner authorization, 모집글 Guard, remember me, localStorage token, 복잡한 CSRF framework는 이번 차시에서 추가하지 않았습니다.

## 확인한 공식 자료

- [Nest 인증 문서](https://docs.nestjs.com/security/authentication): AuthService와 JWT 인증 구조.
- [Nest JWT 공식 저장소](https://github.com/nestjs/jwt): registerAsync, signAsync, verifyAsync 및 옵션.
- [cookie-parser 공식 저장소](https://github.com/expressjs/cookie-parser): 요청 Cookie 파싱.
- [Express 5 API](https://expressjs.com/en/5x/api.html#res.clearCookie): cookie/clearCookie 옵션.
- [bcryptjs 공식 저장소](https://github.com/dcodeIO/bcrypt.js): compare 및 UTF-8 72바이트 제한.

패키지 호환 범위와 정확한 버전은 npm registry 메타데이터 및 저장소 lockfile로 확인했습니다.

독립 코드 리뷰에서 발견한 이메일 규칙 불일치와 Swagger cookie security scheme 불일치는 각각 회귀 테스트로 실패를 재현하고 수정했습니다. 현재 두 항목 모두 통과하며 미해결 리뷰 항목은 없습니다.
