# 21차시 — 회원가입 API와 비밀번호 hash

## 목표와 범위

회원가입은 User row를 만드는 API입니다. 이번 차시에서는 `POST /api/auth/signup`으로 name, email, password를 받고 비밀번호의 hash만 DB에 저장합니다. 로그인/JWT, cookie, Guard, me, logout, refresh token, OAuth는 구현하지 않습니다. 기존 4~20차시 화면과 모집글 CRUD는 보존합니다. 원래 21차시 체크포인트 `dfb5e28`은 API까지 구현했습니다. 이후 [21차시 화면 보완 실습](session-21-signup-ui.md)을 추가해 `/signup`에서 가입 완료까지 수행할 수 있습니다. 이 문서의 아래 기록은 원래 API 구현 기록으로 보존합니다.

## 구조와 변경 파일

```text
AppModule
└─ AuthModule (PrismaModule 재사용)
   ├─ AuthController → POST /api/auth/signup, Swagger
   ├─ SignupDto → 요청 시 실제 값 검증
   ├─ AuthService → hash → prisma.user.create → select
   └─ SignupResponseDto → 공개 응답의 Swagger 문서
```

새 파일은 `apps/api/src/modules/auth/`의 위 다섯 파일, `apps/api/test/signup.e2e.mjs`, 이 노트, Postman 컬렉션, 구현 계획서입니다. `app.module.ts`, `main.ts`, 기존 모집글 create/update DTO, API package.json, 루트 package-lock.json을 수정했습니다. Prisma schema의 기존 User/email unique/passwordHash를 그대로 사용하여 migration은 추가하지 않았습니다.

설치 패키지: `bcryptjs@3.0.3`, `class-validator@0.15.1`, `class-transformer@0.5.1`. bcryptjs는 TypeScript 타입을 포함하고 native build가 필요하지 않습니다.

## 요청과 응답

```http
POST /api/auth/signup
Content-Type: application/json
```

```json
{
  "name": "김학생",
  "email": "student3@example.com",
  "password": "password123"
}
```

성공은 201 Created이며 응답은 아래 네 필드뿐입니다. id와 날짜는 실행마다 달라집니다.

```json
{
  "id": 15,
  "email": "student3-session21-20260919@example.com",
  "name": "김학생",
  "createdAt": "2026-09-19T13:01:30.823Z"
}
```

`password`와 `passwordHash`를 반환하지 않습니다. 중복은 409 Conflict입니다. 이는 요청이 현재 DB 상태(이미 존재하는 email)와 충돌했다는 뜻입니다.

```json
{
  "statusCode": 409,
  "code": "USER_EMAIL_ALREADY_EXISTS",
  "message": "이미 사용 중인 이메일입니다."
}
```

## DTO와 runtime validation

TypeScript 타입만으로 외부 HTTP 입력을 검증할 수 없습니다. `SignupDto`의 name은 `IsString + Length(2,20)`, email은 `IsEmail`, password는 `IsString + Length(8,50)`으로 검사합니다. 누락, null, 숫자 입력, 범위 밖 값은 400입니다.

bcrypt는 UTF-8 72바이트까지만 사용하므로 추가 검증을 둡니다. 예를 들어 한글 24자는 72바이트라 통과하지만 25자는 75바이트라 거절합니다. `ValidateBy`에서 잘못된 UTF-16 surrogate를 거절하고 `Buffer.byteLength`로 길이를 확인합니다. 설치된 `IsByteLength`는 내부 encodeURI가 잘못된 surrogate에 예외를 던지므로 사용하지 않습니다. 정상 emoji 등 surrogate pair는 허용됩니다.

전역 `ValidationPipe({ whitelist: true })`는 DTO에 선언되지 않은 id/passwordHash/관계 객체 등을 제거합니다. transform과 forbidNonWhitelisted는 켜지 않았습니다. 기존 모집글 DTO에는 `@Allow()`를 붙여 필드가 제거되지 않게 하되 기존 Service 검증 동작을 보존했습니다. Swagger 데코레이터만으로 whitelist에 포함되지는 않습니다.

깨진 JSON은 DTO 이전의 JSON parser에서 실패합니다. parser 오류에는 요청 본문 일부가 들어갈 수 있어 `main.ts`의 짧은 오류 middleware가 이를 고정된 400 메시지로 바꿉니다. 일반 validation 오류 형식은 Nest 기본 형식을 유지합니다.

## hash, salt, cost, select

암호화(encryption)는 키를 가진 쪽에서 원문을 복호화할 수 있게 만드는 방식입니다. 비밀번호 hash는 원문 복호화를 목적으로 하지 않습니다. 로그인에서는 저장된 hash를 복호화하지 않고 `compare(입력한 비밀번호, 저장된 hash)`로 일치 여부를 확인합니다.

```ts
const passwordHash = await hash(body.password, 10);
return await this.prisma.user.create({
  data: { name: body.name, email: body.email, passwordHash },
  select: { id: true, email: true, name: true, createdAt: true },
});
```

cost 10은 학습용 설정입니다. 숫자 cost를 전달하면 bcryptjs가 매번 새 salt를 생성하므로 같은 비밀번호도 서로 다른 hash를 만듭니다. 서버에는 password 필드 자체를 저장하지 않습니다. select는 DB에서 응답에 필요한 필드만 가져와 민감 필드가 응답 객체에 들어오는 것을 방지합니다. Swagger 응답 DTO는 문서이며, 보안 경계는 실제 select입니다.

중복 사전 조회만으로는 동시에 도착한 가입 요청을 막을 수 없습니다. 기존 email `@unique`를 신뢰하고 create에서 Prisma `P2002`를 잡아 409로 바꿉니다. 나머지 DB 오류는 중복으로 오인하지 않고 다시 던집니다. 현재 이메일 비교는 기존 PostgreSQL의 대소문자 구분 정책을 그대로 사용합니다.

## 직접 실행하기

이 worktree 루트에서 실행합니다. `.env`는 기존 로컬 수업 DB 설정을 복사했고 Git에 포함하지 않았습니다. 기존 Docker PostgreSQL 컨테이너를 사용하므로 다른 Compose 프로젝트로 같은 5432 포트를 새로 띄울 필요가 없습니다.

```powershell
npm ci
npm run build --workspace=@campus-crew/api
$env:PORT='4021'
npm run start:api
```

Swagger: http://localhost:4021/docs → auth → POST /api/auth/signup → Try it out → Execute.

1. 아직 없는 email과 정상 값 → 201, 공개 필드 네 개 확인.
2. 같은 email을 다시 실행 → 409와 USER_EMAIL_ALREADY_EXISTS.
3. email을 not-email로 변경 → 400.
4. password를 short로 변경 → 400.
5. DB에서 row와 hash 확인.

Postman에서는 `docs/postman/session-21-signup.postman_collection.json`을 import하고 위에서 아래 순서로 실행합니다. baseUrl 기본값은 `http://localhost:4021`입니다. 첫 요청이 매번 새 email을 설정하며 둘째 요청은 같은 값을 재사용합니다. Collection Runner의 테스트가 상태 코드와 민감 필드 미노출을 검사합니다. 실행마다 테스트 사용자 1명이 남습니다.

DBeaver SQL Editor 또는 psql에서 아래 SQL을 실행하면 전체 hash를 화면에 노출하지 않고 확인할 수 있습니다.

```sql
SELECT id, email, name,
       length("passwordHash") AS hash_length,
       left("passwordHash", 7) AS hash_prefix,
       "passwordHash" = 'password123' AS is_plaintext
FROM users
WHERE email = 'student3-session21-20260919@example.com';
```

## 실제 검증 기록 (2026-09-19)

- Docker `campus-crew-session-15-postgres-1`: PostgreSQL 17 healthy, 5432.
- 별도 API 4021 포트에서 Swagger UI를 열고 Execute로 가입 201 확인.
- 실제 생성 id 15, name 김학생, 위 기록의 email/createdAt, 응답에 password/passwordHash 없음.
- 같은 Swagger 요청 재실행: 409, USER_EMAIL_ALREADY_EXISTS, 한국어 메시지 확인.
- SQL: hash_length=60, hash_prefix=$2b$10$, is_plaintext=false.
- UI 시연 사용자 1명은 DBeaver 재확인용으로 유지. 당시 DB users 4, recruitments 8, applications 3.
- DB 검증은 직접 SQL로 수행했습니다. DBeaver UI와 Postman UI를 직접 조작한 것으로 표기하지 않습니다. Postman 컬렉션은 재실습용이며 실제 UI 요청 검증 도구는 Swagger입니다.
- 구현 전 새 signup 테스트 6개는 404로 실패. 구현 후 통과.
- 독립 리뷰에서 malformed Unicode 500 및 malformed JSON 오류의 본문 노출을 재현하는 테스트 2개를 추가하여 실패를 확인한 뒤 수정.
- 실제 DB API e2e 19/19 통과: 기존 CRUD 11개 + signup 8개. 정상/중복/동시 중복/유효성/경계/72바이트/Swagger/깨진 Unicode/깨진 JSON, hash compare와 무작위 salt 확인 포함.
- 자동 테스트는 실행별 고유 email/id로 생성한 행만 정리하고 실행 전후 기존 DB 행이 동일한지 확인합니다. API 테스트 파일은 DB snapshot 충돌을 피하기 위해 순차 실행합니다.

## 50분 수업 흐름

| 시간    | 활동                                                          |
| ------- | ------------------------------------------------------------- |
| 0~5분   | 회원가입이 User row 생성이라는 점, password 평문 저장 위험    |
| 5~15분  | AuthModule/Controller/Service와 SignupDto, runtime validation |
| 15~25분 | bcrypt hash/salt/cost, Prisma create/select                   |
| 25~35분 | email unique, 동시 요청, 409 Conflict                         |
| 35~45분 | Swagger 정상/중복/400, SQL hash 확인                          |
| 45~50분 | 완료 체크와 다음 차시 compare/login/JWT 예고                  |

완료 기준: 정상 201, 중복 409, 잘못된 email/짧은 password 400, DB에 hash만 저장, 응답에서 민감 필드 제외, 기존 모집글 동작 유지.

## 다음 22차시

이메일로 User를 조회하고 `bcryptjs.compare(password, user.passwordHash)`로 비밀번호를 검증하는 login API를 만든 뒤 JWT 발급을 학습합니다. 이번 차시에서 토큰이나 로그인 상태는 만들지 않았습니다. 기존 seed의 passwordHash는 이전 차시 데모 값일 수 있으므로 로그인 실습에는 이번 signup으로 생성한 사용자를 이용하거나 다음 차시에서 seed를 별도 검토합니다.

## 공식 참고자료

- [NestJS ValidationPipe](https://docs.nestjs.com/techniques/validation)
- [bcryptjs 사용법과 72바이트 제한](https://github.com/dcodeIO/bcrypt.js)

## 20차시 보존 확인

21차시 브랜치에 완료된 20차시 커밋 `fe1e963`을 fast-forward로 포함했습니다. 20차시 수정/삭제 코드는 동일하며 원래 worktree와 커밋은 변경하지 않았습니다. 통합 후 웹 테스트 20/20이 통과했습니다.

Swagger UI에서 잘못된 이메일은 `email must be an email` 400, 짧은 비밀번호는 길이 검증 메시지 400도 확인했습니다.

최종 통합 브랜치의 `npm run check`도 통과했습니다: 전체 format:check, API/web lint, API/web build. Next 빌드에 `/recruitments/[id]/edit`가 포함되어 20차시 화면이 보존됨을 확인했습니다.
