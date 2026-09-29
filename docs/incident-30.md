# Incident 30 — Production API proxy 환경변수 누락

## Symptom

2026-09-23, 29차시 커밋 `fa44bfd`의 **격리된 로컬 production build**에서 재현했다. `/recruitments` HTML은 200이지만 `GET /api/recruitments?limit=1`은 500, 본문은 `Internal Server Error`였다. 브라우저는 “모집글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.”를 표시했다. Next 서버 로그는 `Failed to proxy http://localhost:4000/...`, `ECONNREFUSED`였다.

## Impact

API 주소 없이 빌드하고 로컬 4000 포트에 API가 없는 환경에서 목록·상세·인증 프록시가 실패한다. 정적 페이지 200이나 build 성공만으로 정상 배포라고 판단할 수 없다. 실제 production 장애를 발생시킨 것은 아니다. 운영 환경변수·쿠키 정책·Neon 데이터에는 변경이 없다.

## Reproduction

실습은 29차시 커밋의 별도 checkout에서만 한다. 실행 중인 다른 서버를 종료하지 말고, API 4000이 비어 있는지 확인한다. 실제 production 값을 수정하지 않는다. `.env.local` 등에서 API 변수를 주입하지 않는 깨끗한 checkout을 사용한다.

```powershell
# 29차시 코드, repo root, Node 22.x / npm 10
Remove-Item Env:API_BASE_URL,Env:API_ORIGIN,Env:VERCEL -ErrorAction SilentlyContinue
npm ci --include=dev
npm run build -w apps/web
node node_modules/next/dist/bin/next start apps/web --hostname 127.0.0.1 --port 3030
```

브라우저에서 `http://127.0.0.1:3030/recruitments`를 연다. Network에서 `/api/recruitments` 500을 찾고, 서버 터미널의 `ECONNREFUSED`와 연결한다. 브라우저 쿠키 값/전체 HAR는 기록하지 않는다. 종료는 해당 터미널의 Ctrl+C로 한다.

최근 변경은 `git log -5 --oneline`과 `git show fa44bfd -- apps/web/next.config.ts`로 확인한다. 가설은 “DB가 고장 났다”가 아니라 **빌드 설정 누락으로 프록시 목적지가 localhost가 됐다**이다. `.next/routes-manifest.json`의 rewrites도 확인하되 실제 비밀값은 출력하지 않는다.

## Root cause

29차시 검사는 `process.env.VERCEL`이 있을 때만 `API_BASE_URL` 누락을 거부했다. `VERCEL` 없이 실행한 production build는 개발용 `http://localhost:4000` fallback을 사용했다. 이 목적지는 build 결과에 들어간다. `next start`는 생성된 routes manifest를 사용하므로 시작할 때 환경변수만 바꿔도 목적지가 바뀌는 것은 아니다. Vercel 시스템 변수를 노출하지 않는 설정에서도 기존 검사에만 의존하면 같은 누락을 놓칠 수 있다.

확인한 경계는 Browser → Next rewrite → 존재하지 않는 local API이다. Render/Neon까지 요청이 도달한 증거는 없으며, 이 실습에서 hosted 로그를 관찰했다고 주장하지 않는다.

## Fix

기존 누락 검사 조건에 `NODE_ENV === 'production'`을 추가했다. 이제 VERCEL 유무와 무관하게 production build에는 명시적인 `API_BASE_URL`이 필요하다. 개발 모드의 기본값/과거 `API_ORIGIN`, 기존 Vercel HTTPS/origin 검사, `/api/*` rewrite, 인증 코드는 유지한다.

로컬 복구는 명시적인 local API 주소와 격리된 `_test` DB를 사용해 API/Web을 다시 빌드·실행한다. hosted 복구는 Vercel **Production 환경의 API_BASE_URL을 실제 Render origin으로 설정한 뒤 재빌드/재배포**한다. 환경변수만 저장하고 이전 배포를 그대로 두면 완료가 아니다. Render API 코드나 schema를 바꾸지 않았으므로 이 수정 자체로 Render redeploy/migration은 필요하지 않다.

```powershell
$env:API_BASE_URL = 'http://127.0.0.1:4000' # 로컬 실습 전용
npm run build -w apps/web
```

예상되는 실패 방지: API_BASE_URL을 제거한 수정 버전의 build는 exit 1과 `Set server-only API_BASE_URL before building production.`으로 중단된다. 실습을 위해 이 검사를 제거하거나 CI를 skip하지 않는다.

## Verification

- 수정 전: 기존 Web 테스트 80개 통과; env 없는 production build 성공; HTML 200/API 500 및 브라우저 오류·서버 connection-refused 확인.
- 회귀 테스트 RED: production env 누락/legacy 변수 대체 2개가 `Missing expected rejection`으로 실패했다.
- 수정 후: config 테스트 12개 통과; env 없는 실제 production build는 기대한 진단과 exit 1로 중단했다.
- 로컬 최종 검증: format:check, lint, API 63개 + Web 83개 테스트, API/Web build, Chromium smoke 1개 모두 통과. login 200 → me 200 → list/detail 200 → 새로고침 인증 유지 → logout 200 → me 401 확인.
- 첫 API 테스트 실행은 제한 환경에서 자식 서버 기동 실패로 48개 실패/15개 통과였다. 코드를 변경하거나 skip하지 않고 일반 실행 권한으로 동일 검사를 재실행해 63개 모두 통과했다. 기존 Prisma CLI 관련 audit high 4건은 29차시 기록과 같으며 이번 수정 범위에서 의존성을 변경하지 않았다.

### PR / 배포 완료 기록

| 항목                 | 확인 상태                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 기존 이력 보존       | fa44bfd에서 별도 clone + fix/session-30-production-api-proxy, 4–29차시 원본 유지                                                        |
| 선행 PR              | [#1 — 5–29차시 이력 반영](https://github.com/camelcaramel/campus-crew/pull/1), Actions 전체 quality 통과, merge commit `d45fa82`로 병합 |
| 30차시 PR            | [#2 — production proxy 누락 방지](https://github.com/camelcaramel/campus-crew/pull/2) — 최신 CI/merge 상태는 PR 링크에서 확인           |
| Hosted 배포          | 사용자가 실제 배포 없음 확인; 이번 범위를 코드·PR·CI까지로 확정                                                                         |
| Production smoke     | 미실행 — 실제 배포 없음; 로컬 결과로 대체하지 않음                                                                                      |
| v1.0.0 tag / Release | 생성·push하지 않음; hosted smoke 통과 후 tag 별도 승인 필요                                                                             |

### Hosted smoke 체크리스트

기존 데모 계정을 사용하며 production seed/test prepare는 실행하지 않는다. 목록이 비어 있으면 상세 GET 검증을 통과했다고 기록하지 말고 검증할 데모 글을 사용자와 정한다. 비밀번호·토큰은 문서에 쓰지 않는다.

1. 배포 commit SHA와 Vercel Ready 확인. Vercel build 로그에서 누락 설정 오류가 없고 목적지가 실제 Render API인지 확인한다.
2. `/recruitments` 로드, 같은 Vercel origin의 목록 GET 200.
3. 로그인 POST 200; HttpOnly/Secure/SameSite=Lax 쿠키 옵션 확인.
4. 새로고침 후 `/api/auth/me` 200.
5. 목록 및 기존 글 상세 GET 200.
6. 재현 때 실패했던 목록 요청이 성공하는지 확인. 의도적으로 production 변수를 지우지는 않는다.
7. 로그아웃 200, 이후 `/api/auth/me` 401.
8. 같은 시간대 Vercel/Render 로그의 proxy/DB 오류 유무 확인. 로컬 로그와 구분해 기록한다.

## Prevention

- 실제 Next config를 실행하는 회귀 테스트 3개: production env 누락 거부, legacy API_ORIGIN으로 숨기기 거부, 명시적인 local API URL 허용.
- 28차시 Playwright에 login/me/list/detail/logout의 HTTP 상태와 logout 후 401을 추가했다. 기존 UI와 새로고침 인증 확인도 유지한다.
- GitHub Actions의 format → lint → 격리 DB → API/Web tests → build → Chromium smoke를 모두 통과한 PR만 merge한다.
- local/CI/production 환경변수와 DB를 분리한다. 테스트 DB 안전장치는 loopback + `_test` 이름을 검사한다. E2E 전에는 반드시 local API 주소로 다시 build한다.
- Vercel Preview에서 수동 확인할 경우 해당 환경의 API_BASE_URL을 별도로 확인한다. 실패 배포를 production으로 승격하지 않는다. 이전 정상 배포로 복구할 때도 proxy/auth smoke를 반복한다.

## 50분 수업

| 시간    | 활동                                                                                                 |
| ------- | ---------------------------------------------------------------------------------------------------- |
| 0–5분   | 격리된 기존 build에서 화면 200 / API 500 관찰                                                        |
| 5–15분  | Network + Next 로그 + git log로 프록시 목적지 가설 확인; hosted에서는 Vercel/Render 로그도 함께 확인 |
| 15–25분 | 실패하는 회귀 테스트 작성 → 누락 검사 최소 수정 → GREEN                                              |
| 25–35분 | format/lint/API tests/build/Playwright; login 성공만으로 인증 검증을 끝내지 않기                     |
| 35–45분 | PR 증상·원인·수정·검증 설명 → CI → review → merge → Vercel redeploy                                  |
| 45–50분 | production smoke → incident 기록 → v1.0 gate 확인                                                    |

이번 저장소는 원격 main이 4차시였으므로 기존 5–29차시를 별도 선행 PR로 전달했다. 학생 수업 전에 이 선행 동기화와 계정 로그인을 완료해 두어야 50분 흐름을 재현할 수 있다.

운영 학습 포인트: 재현 → 증거 → 가설 → 최소 수정 순서를 지킨다. PR/CI는 배포 전 안전장치이며 배포 성공 후에도 실제 smoke가 필요하다. 장애 기록은 다음 진단 시간을 줄인다. secret·DB를 임의로 바꾸지 않는다. v1.0은 기능뿐 아니라 검증과 복구를 경험한 상태이므로 hosted 검증이 남아 있으면 완료로 표시하지 않는다.

참고: [Vercel 시스템 환경변수와 노출 설정](https://vercel.com/docs/environment-variables/system-environment-variables), [Next external rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites), [29차시 배포 안내](deployment.md).
