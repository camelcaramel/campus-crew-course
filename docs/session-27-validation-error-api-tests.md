# 27차시 — 서버 입력 검증, 일관된 에러, API 자동 테스트

26차시의 검색·필터·페이지네이션과 4~25차시 기능을 유지하면서 HTTP 입력 경계를 강화했습니다. Nest 11.2.3, class-validator 0.15.1, class-transformer 0.5.1, Prisma 7.10.0을 그대로 사용합니다. DB 스키마·migration은 변경하지 않았습니다.

## 요청이 처리되는 순서

`HTTP → JSON parser → JWT Guard → ValidationPipe → Controller → Service → Prisma`

예외가 발생하면 전역 `ApiExceptionFilter`가 공개 응답을 정리합니다. 따라서 비로그인 상태에서 잘못된 모집글을 POST하면 Guard가 먼저 401을 반환합니다. 로그인한 뒤 같은 잘못된 본문을 보내면 400입니다.

`main.ts`의 옵션은 다음과 같습니다.

```ts
new ValidationPipe({
  whitelist: true,
  transform: true,
  exceptionFactory: () =>
    new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: '입력값을 확인해주세요.',
    }),
});
```

- `whitelist`: DTO의 검증 데코레이터가 없는 속성은 제거합니다. 예전 요청과의 호환성을 위해 `forbidNonWhitelisted`는 켜지 않았습니다.
- `transform`: HTTP의 평범한 객체를 DTO 인스턴스로 변환합니다. 숫자 필드에 대한 변환 규칙은 별도로 선언해야 합니다.
- 모집글의 `authorId`는 DTO에 없고 인증된 사용자로 결정됩니다. 사용자가 본문에 넣어도 작성자가 바뀌지 않습니다.
- GET 목록의 지역 ValidationPipe는 제거했습니다. 모든 DTO에 같은 전역 정책이 적용됩니다.

## DTO 규칙

기존 `apps/api/src/modules/<모듈>/` 파일 7개를 재사용했습니다. 새 DTO 폴더나 응답 클래스는 만들지 않았습니다.

| DTO 파일                                        | 서버 규칙                                                                   |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `auth/signup.dto.ts`                            | name 문자열 2~~20, email 이메일, password 문자열 8~~50                      |
| `auth/login.dto.ts`                             | SignupDto에서 email/password 규칙 재사용                                    |
| `recruitments/create-recruitment.dto.ts`        | title 문자열 2~~80, content 문자열 10~~2000, category STUDY/PROJECT/CONTEST |
| `recruitments/update-recruitment.dto.ts`        | 같은 title/content/category 규칙, status OPEN/CLOSED; 모든 필드는 생략 가능 |
| `recruitments/recruitment-list-query.dto.ts`    | page 기본 1·최소 1, limit 기본 10·1~50, q 선택 문자열, category 선택 enum   |
| `applications/create-application.dto.ts`        | message 문자열 2~200, 기존 trim 유지                                        |
| `applications/update-application-status.dto.ts` | APPROVED/REJECTED만 허용; PENDING 금지                                      |

PATCH의 optional은 **필드 생략**을 의미합니다. `ValidateIf((_object, value) => value !== undefined)`로 생략은 허용하고 `null`은 거부합니다. `IsOptional`은 null까지 건너뛰므로 이번 DB의 필수 컬럼과 맞지 않습니다. `{}` PATCH도 기존처럼 허용합니다.

26차시의 엄격한 숫자 `@Transform`을 유지했습니다. 숫자로만 된 query string을 변환하며 `page=`, `page=1abc`, 반복 page, 소수는 거부합니다. page와 계산된 skip의 PostgreSQL 정수 상한도 유지합니다.

21차시의 bcrypt 입력 제한도 유지했습니다. 비밀번호는 8~50자이면서 UTF-8 최대 72바이트여야 합니다. 긴 다국어 비밀번호가 bcrypt에 의해 조용히 잘리는 문제를 예방합니다.

## 에러 응답

```json
{
  "statusCode": 409,
  "code": "APPLICATION_ALREADY_EXISTS",
  "message": "이미 지원한 모집글입니다."
}
```

새로운 예외 계층 대신 기존 `BadRequestException`, `ConflictException` 등의 응답 객체를 재사용합니다. 전역 필터는 공개 필드 3개만 내보냅니다. 검증 메시지 배열은 짧은 문자열로 정리하고, 5xx와 예상하지 못한 예외는 원문·stack·DB 정보 없이 공통 안내를 반환합니다. 잘못된 JSON 본문을 숨기는 기존 처리도 유지합니다.

| HTTP status | code                         | 의미                                       |
| ----------- | ---------------------------- | ------------------------------------------ |
| 400         | VALIDATION_ERROR             | DTO 입력 규칙 위반                         |
| 401         | AUTH_REQUIRED                | Cookie 없음, 만료, 위조 또는 삭제된 사용자 |
| 401         | AUTH_INVALID_CREDENTIALS     | 로그인 자격 증명 불일치                    |
| 409         | USER_EMAIL_ALREADY_EXISTS    | 중복 이메일                                |
| 404         | RECRUITMENT_NOT_FOUND        | 없는 모집글                                |
| 403         | RECRUITMENT_FORBIDDEN        | 다른 작성자의 모집글 변경                  |
| 409         | RECRUITMENT_CLOSED           | 마감된 모집글에 지원                       |
| 404         | APPLICATION_NOT_FOUND        | 없는 지원 내역                             |
| 409         | APPLICATION_ALREADY_EXISTS   | 중복 지원                                  |
| 409         | APPLICATION_SELF_NOT_ALLOWED | 자기 모집글에 지원                         |
| 403         | APPLICATION_FORBIDDEN        | 작성자가 아닌 사용자의 지원자 관리         |
| 409         | APPLICATION_INVALID_STATUS   | 이미 결정된 지원을 다시 결정하거나 취소    |
| 500/503 등  | INTERNAL_SERVER_ERROR        | 내부 오류의 안전한 안내                    |

PENDING을 **요청 본문으로 전송**하면 DTO 규칙 위반이므로 400 VALIDATION_ERROR입니다. 이미 APPROVED인 지원을 REJECTED로 **다시 변경**하려 하면 도메인 상태 규칙 위반이므로 409 APPLICATION_INVALID_STATUS입니다.

기존 AUTH_SESSION_CHANGED, INVALID_RECRUITMENT_ID, INVALID_APPLICATION_ID도 유지합니다. 일반 ParseIntPipe/JSON 오류는 BAD_REQUEST, 등록되지 않은 URL은 NOT_FOUND로 정리합니다.

## 테스트 DB 준비와 실행

실제 PostgreSQL이 이미 준비되어 있어 mock 대신 **Jest + Supertest → 실제 Nest bootstrap → Prisma → 테스트 DB**를 사용합니다. 별도 ts-jest 설정 없이 빌드된 서버를 실행하며, 임의 포트를 할당하고 종료합니다. 테스트마다 Controller/Guard/Pipe 구성을 복사하지 않으므로 실제 `main.ts` 설정을 검증합니다.

1. 사용 중인 로컬 PostgreSQL에 별도의 `campus_crew_test` DB를 만듭니다. 수업 데이터가 있는 DB를 테스트 DB로 지정하지 않습니다.
2. 저장소 루트의 `.env.test.example`을 `.env.test`로 복사하고 접속 정보를 맞춥니다.
3. 아래 명령을 저장소 루트에서 실행합니다.

```sh
npm ci
npm run test:prepare -w apps/api
npm test -w apps/api
npm run test:e2e -w apps/api
npm test -w apps/web
```

- `test:prepare`: 테스트 URL 검사 후 기존 migration 적용과 seed. 새 DB 준비 시 한 번 실행합니다.
- `test`: Prisma generate + API build + Jest/Supertest 대표 테스트.
- `test:e2e`: 위 테스트 다음에 기존 node:test API 회귀 테스트 5개 파일을 순차 실행합니다.
- `test:legacy`: 기존 API 회귀 테스트만 실행합니다.
- 테스트 도중 같은 작업 폴더에서 별도의 API build나 다른 API 테스트를 동시에 실행하지 않습니다. dist와 테스트 DB를 공유하기 때문입니다.

`run-tests.cjs`는 개발용 DATABASE_URL로 자동 대체하지 않습니다. **TEST_DATABASE_URL 필수**, 접속 대상은 loopback, DB 이름은 `_test`로 끝나야 합니다. 검사를 통과한 값을 자식 프로세스의 DATABASE_URL로 전달합니다. `.env.test`와 비밀번호는 Git에 포함하지 않습니다.

이번 검증에서는 기존 PostgreSQL 17 컨테이너에 `campus_crew_session27_test`만 새로 만들었습니다. 기존 `campus_crew_verify`는 migration/seed/테스트 대상으로 사용하지 않았습니다. 새 테스트는 실행별 UUID 이메일의 사용자와 그들의 지원·모집글을 외래키 순서에 맞춰 정리합니다. 기존 테스트의 snapshot·cleanup 검증도 유지합니다. DB 전체 삭제나 sequence 초기화는 하지 않습니다.

이 PC에서 npm 경로 문제가 발생하면 README의 임시 `npm_config_prefix` 안내를 사용합니다. 제한된 실행 환경의 Prisma 캐시 권한 문제는 이번 검증에만 `PRISMA_SCHEMA_ENGINE_BINARY`를 같은 7.10.0 로컬 엔진으로 지정해 해결했습니다. 일반 개발 환경의 필수 설정은 아닙니다.

## 대표 테스트와 수동 확인

핵심 HTTP 테스트는 목록 200, 비로그인 생성 401, 실제 중복 지원 409, 잘못된 생성 400, 없는 상세 404입니다. 여기에 DTO 잘못된 길이·타입·null, 숫자 query 변환, whitelist와 authorId 무시, 실패 시 DB 변경 없음, 로그인/중복 이메일, 권한·상태 전이를 확인합니다. 별도 작은 테스트용 Nest 서버에서 500/503 원문 유출 방지와 기존 배열 메시지 정규화도 확인합니다.

Postman 또는 curl에서 다음을 확인합니다. 3~6번의 보호된 API는 먼저 정상 로그인하여 받은 Cookie를 사용합니다.

| 시나리오                  | 기대 결과                      |
| ------------------------- | ------------------------------ |
| 잘못된 signup email       | 400 VALIDATION_ERROR           |
| 짧은 password             | 400 VALIDATION_ERROR           |
| title 1자로 모집글 생성   | 400 VALIDATION_ERROR           |
| category OTHER            | 400 VALIDATION_ERROR           |
| GET 목록 page=0           | 400 VALIDATION_ERROR           |
| application message 1자   | 400 VALIDATION_ERROR           |
| 같은 이메일로 다시 signup | 409 USER_EMAIL_ALREADY_EXISTS  |
| Cookie 없이 모집글 POST   | 401 AUTH_REQUIRED              |
| 없는 모집글 상세          | 404 RECRUITMENT_NOT_FOUND      |
| 같은 모집글에 두 번 지원  | 409 APPLICATION_ALREADY_EXISTS |

간단한 비로그인 확인 예시는 다음과 같습니다.

```sh
curl -i 'http://localhost:4000/api/recruitments?page=0'
curl -i -X POST 'http://localhost:4000/api/recruitments' -H 'Content-Type: application/json' -d '{}'
curl -i 'http://localhost:4000/api/recruitments/2147483647'
```

Windows PowerShell에서는 `curl.exe`를 사용합니다. 정상 서버는 기존 README의 DB/JWT 설정 후 실행합니다. 자동 테스트용 서버는 테스트가 끝나면 종료됩니다.

## 프론트 변경

기존 API client의 GET 및 모집글 생성·수정·삭제는 JSON의 문자열 message를 읽습니다. HTML proxy 오류와 네트워크 실패는 기존 안내를 유지합니다. 로그인은 validation/server message를 표시하되 401은 기존 공통 자격 증명 안내를 유지합니다. Application client는 이미 message와 code를 읽으므로 수정하지 않았습니다. 폼·페이지·TanStack Query 구조는 바꾸지 않았습니다.

## 학생 학습 포인트

1. TypeScript type/interface는 컴파일 후 사라지므로 외부 HTTP 입력을 검사하지 못합니다.
2. DTO class와 class-validator 데코레이터가 서버의 런타임 입력 경계를 만듭니다.
3. ValidationPipe는 Controller 실행 전에 DTO를 검사합니다. Guard는 그보다 먼저 실행됩니다.
4. whitelist는 허용한 필드만 남기고, transform은 DTO와 선언된 변환 규칙을 적용합니다.
5. FE Zod는 사용자 입력 경험을 돕습니다. 사용자는 FE를 우회할 수 있으므로 BE 검증은 따로 필요합니다.
6. 일관된 error shape는 프론트 표시와 디버깅 분기를 단순하게 만듭니다.
7. HTTP status는 실패의 큰 종류, application code는 서비스 안에서의 구체적인 원인입니다.
8. 자동 테스트는 이전 차시 동작이 깨졌는지 빠르게 알려줍니다.
9. 200뿐 아니라 401/400/404/409와 실패 시 DB 불변도 확인합니다.
10. 다음 28차시에는 이 명령을 GitHub Actions의 PR gate에 연결합니다.

## 다음 28차시

GitHub Actions에서 별도 PostgreSQL service DB를 준비하고 TEST_DATABASE_URL을 설정한 뒤 `npm ci`, `test:prepare`, format/lint/build, API e2e, web test를 실행하는 흐름으로 이어집니다. 이번 차시에는 workflow를 추가하지 않았습니다. Playwright smoke는 로그인·목록·상세 같은 짧은 브라우저 경로를 확인하여 이번 HTTP 수준 테스트를 보완합니다.

## 실제 검증 결과 — 2026-09-23

| 검증                               | 결과                                                           |
| ---------------------------------- | -------------------------------------------------------------- |
| `npm test -w apps/api` / Jest 부분 | 56/56 통과: 실제 앱 HTTP 48, 필터 HTTP 3, 테스트 DB 안전장치 5 |
| `npm run test:e2e -w apps/api`     | 위 56개 + 기존 API 회귀 59개, 총 115개 통과                    |
| `npm test -w apps/web`             | 71/71 통과                                                     |
| `npm run format:check`             | 통과                                                           |
| `npm run lint`                     | API·web 모두 통과                                              |
| `npm run build`                    | API·web 모두 통과                                              |
| curl 실제 서버 확인                | page=0·잘못된 signup 400, 비로그인 POST 401, 없는 상세 404     |
| 테스트 후 DB 확인                  | seed 3 users / 6 recruitments / 3 applications만 남음          |

별도 리뷰에서 큰 JSON 본문/지원하지 않는 charset의 413/415 상태 보존과 테스트 DB URL query의 host/database 우회 차단을 보완했습니다. TEST_DATABASE_URL의 query 옵션은 `schema`만 허용합니다. 기존 package-lock의 모든 패키지 버전은 유지했고 Jest·Supertest 의존성만 추가했습니다.

주요 변경 파일은 `main.ts`, `common/api-exception.filter.ts`, 모집글 create/update DTO·controller·service, `applications.service.ts`, API 테스트·실행 설정, 프론트 API client·모집글/로그인 요청 함수, 테스트 환경 예제·README·본 문서입니다. 기존 7개 DTO 중 auth/application/list DTO는 규칙이 충족되어 내용을 그대로 재사용했습니다. 이전 API 테스트는 validation message 배열 기대값과 10자 미만 본문 fixture만 새 규칙에 맞춰 변경했습니다.
