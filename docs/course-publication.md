# 교육용 공개 준비와 검증 기록

검사일: 2026-09-29. 대상 원본 main: `bc73b03`.

## 원본과 이력 보존

- 독립 clone에서 학생 가이드를 추가했습니다. 원본 checkout, main, remote, 기존 브랜치·커밋은 수정하지 않습니다.
- 원본 main의 36개 커밋과 별도 회원가입 UI 보완 커밋 `80e31ec`를 포함해 기존 37개 커밋을 보존합니다. 보완 커밋은 `lesson/session-21-signup-complete` 브랜치로 공개합니다.
- 새 저장소는 `camelcaramel/campus-crew-course`, public입니다. 기존 원본 `camelcaramel/campus-crew`로 push하지 않습니다.
- 실제 비밀값이 발견되지 않아 sanitized history를 만들거나 commit ID를 재작성하지 않았습니다.
- checkpoint 태그는 [매핑 근거](course-checkpoints.md)의 실제 커밋을 가리킵니다. 정확한 3차시 종료 상태만 없으므로 최초 4차시 commit을 명시적 대체값으로 사용합니다.

## Secret 검사

- 공식 Gitleaks 8.30.1 Windows 배포물을 SHA-256 체크섬 확인 후 사용했습니다.
- `gitleaks git --log-opts="--all" --redact=100`: 전체 refs 검사, 34개 non-merge commit diff, 약 1.59 MB, 탐지 0건. merge를 포함한 전체 commit 수는 37개입니다.
- 별도 객체 검사: 전체 refs의 796개 Git 객체 중 374개 blob 버전을 읽어 DB URL, JWT/cookie secret, Vercel/Render/Neon/OAuth/access token, Bearer, private key 및 알려진 token 형식을 확인했습니다. 실제 외부 DB credential·token·private key 후보 0건입니다.
- 모든 역사에서 발견된 환경 파일 경로는 `.env.example`, `.env.test.example`, `apps/api/.env.example`, `apps/web/.env.example`뿐입니다. 실제 `.env`, `.env.test`, `.env.local`은 추적되지 않습니다.
- 예제 및 CI에는 loopback DB의 학습용 값, 일회용 테스트 계정과 test-only JWT 문자열이 있습니다. 외부 서비스용 credential이 아니며 production 재사용을 금지합니다. API 예제의 JWT placeholder는 시작 시 거절됩니다.
- `.gitignore`는 모든 깊이의 `.env*`를 제외하고 두 종류의 example만 허용합니다. 의존성, 생성된 Prisma Client, 빌드 결과, 로그, Playwright 결과도 제외됩니다.
- 배포 문서의 공개 서비스 URL·리소스 식별자와 예제용 이메일은 비밀 credential이 아닙니다. 검사 결과 실제 비밀값 노출이나 rotation 필요 사유는 발견하지 못했습니다. 패턴 검사가 모든 종류의 비밀정보 부재를 보증하지는 않습니다.

## 로컬 실행 검증

원본 의존성 및 앱 코드를 변경하지 않고 Node 22.17.1 / npm 10.9.2에서 검증했습니다.

| 검사                       | 결과                                              |
| -------------------------- | ------------------------------------------------- |
| `npm ci`                   | 성공, lockfile 그대로 설치                        |
| `npm run lint`             | API/Web 통과                                      |
| `npm test -w apps/web`     | 88개 통과                                         |
| `npm run test:e2e:prepare` | 별도 로컬 테스트 DB에 migration/fixture 준비 성공 |
| `npm test -w apps/api`     | 4 suite, 63개 통과                                |
| `npm run build`            | API/Web production build 성공                     |
| `npm run test:e2e`         | Chromium 3개 통과                                 |

브라우저 검증은 로그인→목록→상세→로그아웃, 회원가입→중복 오류→로그인→새로고침, pending/통신 실패 재시도를 포함합니다. 테스트 DB는 이번 작업 전용 loopback `_test` 데이터베이스이며 기존 로컬/production DB를 수정하지 않았습니다.

## 배포본의 의미

`v1.0.0`은 검증된 최종 앱 코드와 학생 가이드를 묶은 **교육용 소스 배포본**입니다. 신규 Render/Vercel 배포를 의미하지 않습니다. 원본의 hosted 배포·HTTPS 확인 기록은 [deployment.md](deployment.md)에 남아 있습니다. 이번 공개 준비에서 새 production credential을 사용하거나 production 데이터를 변경하지 않았습니다.

교사 및 학생은 기존 dependency/운영 제한 사항을 [배포 문서](deployment.md)의 의존성 참고와 [과거 README](README-history.md)에서 함께 확인하세요. 이번 작업은 수업 history와 실행 버전의 재현성을 보존하기 위해 의존성을 업그레이드하지 않았습니다.
