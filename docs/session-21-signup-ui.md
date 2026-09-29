# 21차시 보완 — 화면에서 회원가입 완료하기

기존 21차시의 회원가입 API와 비밀번호 hash 저장에 **가입 화면 → 입력 검증 → API 호출 → 가입 완료 안내**를 연결합니다. 기존 차시별 커밋은 수정하지 않고 보완 커밋을 추가합니다. 가입은 사용자 생성이고 로그인은 22차시입니다. 가입 성공만으로 JWT를 발급하거나 로그인 상태를 만들지 않습니다.

## 1. 파일과 학습 순서

| 순서 | 파일                                          | 역할                                                       |
| ---- | --------------------------------------------- | ---------------------------------------------------------- |
| 1    | `apps/web/src/features/auth/signup-schema.ts` | Zod로 이름·이메일·비밀번호·확인 입력 검증                  |
| 2    | `apps/web/src/features/auth/signup-api.ts`    | same-origin `POST /api/auth/signup`, 응답·오류 처리        |
| 3    | `apps/web/src/features/auth/signup-form.tsx`  | React Hook Form과 useMutation 연결, pending·오류·성공 표시 |
| 4    | `apps/web/src/app/signup/page.tsx`            | `/signup` 페이지에 폼 배치                                 |
| 5    | `apps/web/src/components/layout/header.tsx`   | 비활성 회원가입 버튼을 `/signup` Link로 변경               |
| 6    | `apps/web/test/signup.test.mjs`               | 입력 경계·API 요청·오류 처리 검증                          |

위 파일은 22차시의 loginSchema, 로그인 mutation, auth/me에 의존하지 않습니다. 21차시까지 설치된 RHF·Zod·TanStack Query와 기존 Providers를 사용하며 추가 패키지는 없습니다. 백엔드와 Prisma schema/migration도 변경하지 않습니다.

## 2. 입력 검증

- 이름: 앞뒤 공백 제거 후 2~20자. 비어 있는 이름도 거절합니다.
- 이메일: 프론트에서 기본 형식을 확인하고 서버 DTO가 최종 판단합니다. 서버가 허용하는 국제화 이메일을 프론트에서 임의로 차단하지 않습니다.
- 비밀번호: Unicode 문자 기준 8~50자, UTF-8 최대 72바이트. bcrypt의 바이트 제한을 넘거나 잘못된 surrogate 문자가 포함되면 거절합니다. 비밀번호의 공백을 trim하지 않습니다.
- 비밀번호 확인: 비밀번호와 같아야 하며 오류는 확인 입력 아래에 표시합니다. 이 값은 DB/API에 보내지 않습니다.
- 클라이언트 검증을 통과해도 서버 검증은 항상 유지합니다.

```typescript
const {
  register,
  handleSubmit,
  formState: { errors },
} = useForm<SignupValues>({
  resolver: zodResolver(signupSchema),
  defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
});
```

## 3. 같은 origin으로 API 호출

```typescript
fetch('/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: values.name,
    email: values.email,
    password: values.password,
  }),
});
```

Next rewrite가 Nest에 전달합니다. 프론트 코드에 Render origin이나 DATABASE_URL/JWT_SECRET을 넣지 않습니다. API 성공 응답은 사용자 공개 정보이며 passwordHash는 제외됩니다.

| 응답/상태                 | 화면 동작                                                |
| ------------------------- | -------------------------------------------------------- |
| 입력 검증 실패            | 필드별 설명과 aria-invalid, API 호출 안 함               |
| 요청 진행 중              | 가입 중 표시, 입력과 제출 버튼 비활성화                  |
| 201                       | 입력·mutation 상태 정리, 가입 완료 안내와 로그인 링크    |
| 409                       | 이미 사용 중인 이메일 안내, 다른 이메일 또는 로그인 선택 |
| 400                       | 입력 형식 재확인 안내                                    |
| 서버·프록시·네트워크 실패 | 내부 오류 내용 대신 재시도 안내, 버튼 다시 활성화        |

비밀번호를 URL·localStorage·로그에 남기지 않습니다. 가입 요청은 자동 재시도하지 않습니다. 서버 처리 후 연결이 끊긴 경우 다시 가입하면 409가 나올 수 있으므로 해당 이메일로 로그인을 확인합니다.

## 4. 직접 확인하기

1. 로컬 Web과 API, 개발 DB를 실행한 뒤 상단 회원가입으로 `/signup`에 들어갑니다.
2. 빈 값·짧은 이름·잘못된 이메일·짧은 비밀번호·불일치 확인 값을 입력합니다. 필드 오류가 보이고 Network에 signup 요청이 없는지 확인합니다.
3. 새 실습 이메일과 개인 비밀번호를 입력합니다. Network에서 POST `/api/auth/signup`의 201과 완료 안내를 확인합니다. 비밀번호가 보이는 요청 본문이나 전체 trace를 공유하지 않습니다.
4. 새로고침 후 같은 이메일로 다시 가입하여 409와 중복 안내를 확인합니다.
5. DBeaver에서 공개 사용자 필드와 passwordHash 존재 여부를 확인합니다. 평문 비밀번호나 hash 전체를 강의 자료에 기록하지 않습니다.
6. **21차시에서는 가입 완료까지 확인합니다.** 로그인 링크의 목적지 `/login`은 22차시에서 구현합니다. 현재 통합본에서는 가입 → 로그인 → 새로고침 → auth/me 200 → 로그아웃 → 401까지 이어서 확인할 수 있습니다.

```sh
npm run test -w apps/web
npm run lint -w apps/web
```

28차시 이후 통합본의 `apps/web/e2e/signup.spec.ts`는 실제 가입·중복 오류·로그인과 새로고침, pending·통신 실패 재시도를 검증합니다. production DB가 아닌 별도 `_test` DB에서 실행합니다.

## 5. 차시별 Git 이력 유지

- 기존 21차시 `dfb5e28`과 22~30차시 커밋·브랜치는 원래 의미대로 보존합니다. rebase/amend/force push로 과거에 코드를 끼워 넣지 않습니다.
- 회원가입 핵심 보완은 `feat: complete session 21 signup UI`라는 별도 커밋으로 묶습니다. 22차시 이후 파일 변경과 Playwright 검증은 후속 통합 커밋으로 구분합니다.
- 새 수강자는 21차시의 기존 API 실습 다음에 이 보완 실습을 수행한 뒤 자기 학습 브랜치에서 22차시를 계속합니다.
- 과거 차시 checkout을 사용하는 경우 원본 브랜치에서 직접 작업하지 말고 보완 학습 브랜치를 만듭니다. 보완 커밋만 적용하며 30차시 전체 코드를 21차시로 가져오지 않습니다.
- 과거 체크포인트를 checkout하면 그 당시 코드가 보이는 것이 정상입니다. 보완 커밋 적용 후 과거 22차시 브랜치로 단순 전환하면 보완 변경을 포함하지 않는 과거 상태로 돌아갑니다. 자기 학습 브랜치에서 다음 실습을 이어가거나 최신 통합 main을 사용하세요.

### 바로 사용할 수 있는 21차시 전용 체크포인트

`checkpoint-21-signup-ui`는 원래 21차시 `dfb5e28` 바로 다음에 회원가입 화면 보완 `80e31ec`만 추가한 상태를 보존한 annotated 태그입니다. 현재 main의 로그인·지원·배포 코드는 포함하지 않습니다. 원래 Header의 비활성 로그인은 보존하고 회원가입만 활성화했습니다. 통합본 보완 커밋 `f16094a`와 기능은 같지만 Header 문맥 차이를 정리했으므로 커밋 ID가 다릅니다.

```sh
git status
git fetch origin --tags
git switch -c my/session-21-signup checkpoint-21-signup-ui
```

기존 `lesson/session-21-signup-complete` 브랜치는 PR #1 충돌 해결을 위해 최신 main과 통합되었습니다. 21차시만 실습할 때는 위의 고정 태그를 사용하세요. Fork에 태그가 없으면 수업 저장소를 upstream으로 추가한 후 `git fetch upstream --tags`로 받습니다.

작업 중인 변경이 있다면 먼저 자신의 작업을 커밋하거나 별도 worktree에 보존합니다. 새 실습 브랜치에서 21차시 가입 완료를 확인하고 22차시 실습 코드를 이어 작성하세요. 기존 22차시 커밋을 일괄 cherry-pick하면 Header 충돌이 날 수 있으므로 단순히 통합본 커밋 전체를 과거 차시에 복사하지 않습니다.
