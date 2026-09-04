# IDT 투자발견 v2.4 프로덕션 마무리 보고서

작성일: 2026-09-04  
제품: IDT 투자발견  
범위: 배포본 운영자 로그인 벽 + 투자 데이터 서버 함수 보호 + Full 100 잠금 유지  
Full 100: **재실행하지 않음** (`EXECUTE_FULL_100 = NO`, `V24_OPERATOR_ENABLED = false`)

`docs/COMPLETION_v2.4.md` 는 수정하지 않았다. 이번 문서는 프로덕션 보호만 다룬다.

---

## A. AUTH

```text
VITE_AUTH_ENABLED:     true
deploy.database:       true
Sign-in methods:       Google, X  (email/password OFF)
SignInGate:            ON (HydrateGate 앞)
UserButton:            ON (셸)
/api/auth/*:           mounted
/login:                mounted
```

배포본과 프리뷰 모두 실제 로그인이다. 데모/목 사용자를 넣지 않았다.

한 줄: 로그인하지 않은 클라이언트는 투자 DB를 하이드레이션하지 못한다.

---

## B. SCHEMA

```text
migrations/auth/0001_auth.sql  →  migrations/0001_auth.sql
copy:                          byte-identical
migrator glob:                 migrations/*.sql (auth/ 하위는 여전히 미적용)
```

기존 도메인 테이블(`0002_idt_domain.sql`, `0003_research_queue.sql`)은 그대로다. `user_id` 컬럼을 투자 테이블에 추가하지 않았다. 단일 운영자 워크스페이스이며, 인증은 벽이지 멀티테넌시가 아니다.

Full 100 행을 drop/recreate 하지 않았다.

---

## C. GATES

```tsx
<AuthProvider>
  <SignInGate fallback={<SignInScreen />}>
    <HydrateGate>
      <AppShell>
        <Outlet />
      </AppShell>
    </HydrateGate>
  </SignInGate>
</AuthProvider>
```

- pending: SignInGate 가 children 을 그리지 않음 → hydrate 없음
- signed_out: 운영자 로그인 화면 (Google / X)
- signed_in: 기존 대시보드 / 발굴 / 종목 / X-Bagger / Oversold / Quality / 매트릭스 / Evidence / 이력 / 큐 / 유니버스 / 설정

Grok 게이트 뷰어는 제로클릭 세션이다. 게이트 세션에 로그인 버튼을 띄우지 않는다. `UserButton` 은 게이트 세션에서 로그아웃을 숨긴다.

---

## D. SERVER FUNCTIONS

`authMiddleware` 가 다음을 막는다. 세션 없으면 `UnauthorizedError` (401).

persist (`src/lib/persist/actions.ts`, 21개):

- `loadWorkspaceFn` `persistWorkspaceFn` `saveCompanyFn` `insertAnalysisFn` `saveAnalysisTransactionFn`
- `clearWorkspaceFn` `cleanupDemoDataFn` `recoverStaleRunsFn` `livePreflightFn` `queueStateFn`
- `startFull100Fn` `processFull100ChunkFn` `pauseFull100Fn` `resumeFull100Fn` `cancelFull100Fn`
- `full100DumpFn` `full100CheckpointFn` `full100ReportFn`
- `v24StartFn` `v24ChunkFn` `v24ResearchOneFn`

research:

- `researchTicker`

쿼리를 `context.userId` 로 나누지 않았다. 스키마가 unowned 이고, 핸드오프는 운영자 벽이지 유저별 테이블 이전이 아니다.

---

## E. EXECUTION LOCK

```text
EXECUTE_FULL_100 = false
V24_OPERATOR_ENABLED = false
이번 작업에서 Full100 run 생성:  0
INOD / 005930.KS / 105560.KS:     재조사 안 함
Smoke 12 extra:                    재조사 안 함
```

테스트 `keeps EXECUTE_FULL_100 off` / `keeps v2.4 operator locked` 통과.

---

## F. CI

프로덕션 하드닝 커밋이 GitHub Actions 에서 초록인 뒤에만 LAST VERIFIED 를 갱신했다.

```text
Typecheck:          PASS
Lint:               PASS
Tests:              PASS (local 172 app tests, 0 fail; CI npm test PASS)
Production Build:   PASS

GitHub Actions:
SUCCESS
  run: 33869680618
  sha: 6968c7b617a0b80205875b9a245c0f00e8546d61
  url: https://github.com/JohnnyHan93/tenbagger-lite/actions/runs/33869680618
  completed: 2026-09-04T11:56:30Z
```

단계: npm ci PASS → typecheck PASS → lint PASS → tests PASS → build PASS.

---

## G. DEPLOYMENT

```text
Alias:                 https://tenbagger-lite.vercel.app
HTTP:                  200
Build assets:          styles-bNx515I-.css / index-CMS-QM0T.js / login-6fL812D3.js
                       (로컬 npm run build 산출물과 동일 해시)
/api/auth/get-session: 200  body=null   (비로그인)
```

비로그인 HTML 은 SignInGate pending 이라 본문이 비어 있고, 클라이언트 번들이 로그인 화면을 그린다. 대시보드 셸은 세션 전에 하이드레이션되지 않는다.

---

## H. PERSISTENCE

```text
deploy.database:                 true
로컬 빌드 migrate:               DATABASE_URL unset → skip (정상, 프리뷰는 PGLite)
프로덕션 get-session:            200  (Better Auth 백엔드 기동)
Full 100 실데이터 위치:          프리뷰 durable PGLite (gitignored data/)
프로덕션 Neon 에 Full 100 복사:  하지 않음 (재조사도 하지 않음)
```

이 커넥터의 Vercel 팀 목록에는 `tenbagger-lite` 프로젝트가 보이지 않아 `DATABASE_URL` 값을 직접 읽지는 못했다. 빈 프로덕션 워크스페이스를 Full 100 유실로 읽지 말 것. 프리뷰 PGLite ≠ 프로덕션 Neon.

프로덕션이 Neon 이면 스키마(auth + 도메인 + 큐)가 빌드 시 migrate 된다. 점수는 로그인 후 비어 있을 수 있다. 그것은 정직하다.

---

## I. UNAUTHORIZED

```text
HydrateGate:                 SignInGate 뒤에만 마운트
loadWorkspaceFn:             authMiddleware → 401
researchTicker:              authMiddleware → 401
get-session (prod, no cookie): 200 null
```

비로그인 세션은 투자 DB 를 읽거나 조사 파이프라인을 돌리지 않는다.

---

## J. AUTHORIZED

로그인(또는 Grok 게이트 제로클릭) 후:

Dashboard / Discover / Company / X-Bagger / Oversold / Quality / Cross / Evidence / History / Queue / Universe / Settings

세 엔진은 합치지 않는다. Research Priority 는 매수 신호가 아니다.

프리뷰에서 게이트 신원은 운영자를 자동 로그인한다. 루프백 스모크(세션 없음)는 로그인 화면을 보여 주는 것이 맞다.

---

## K. FLAGS

```text
EXECUTE_FULL_100:        NO
V24_OPERATOR_ENABLED:    false
VITE_AUTH_ENABLED:       true
emailAndPasswordEnabled: false
```

---

## L. REGRESSION

로컬:

```text
Typecheck:        PASS
Lint:             PASS
Tests:            PASS (172 app / 0 fail)
Production Build: PASS
auth-invariant:   dev and build agree: sign-in on
```

```text
Smoke12 extra 9:        untouched
INOD / 005930 / 105560: untouched
Fake demo:              0
Sample100:              100
Three engines:          independent
CFO / FCF:              unchanged
Sticky identity column: unchanged
Queue UI:               LOCKED
```

---

## M. LAST VERIFIED

`src/lib/research/verified-build.ts` 는 GitHub Actions SUCCESS SHA 만 가리킨다. 미검증 SHA 를 미리 쓰지 않았다.

```text
commitSha:   6968c7b617a0b80205875b9a245c0f00e8546d61
verifiedAt:  2026-09-04T11:56:30.000Z
source:      github-actions
run:         33869680618
```

이 문서 커밋은 LAST VERIFIED 의 대상이 아니다.

---

## N. LIMITS

- 투자 테이블은 여전히 unowned. 로그인한 운영자 누구나 같은 워크스페이스를 본다.
- Full 100 실측 데이터는 프리뷰 durable PGLite 에 있다. 프로덕션 Neon 으로 이전하지 않았다.
- Quality 70 의 3Y CAGR 공백은 그대로 RESEARCH_REQUIRED. 조작하지 않았다.
- `src/lib/auth/*` 는 `email-password.ts` 플래그 외 수정하지 않았다.
- `src/routes/auth/popup.tsx` 를 만들지 않았다.

---

## O. FINAL STATE

```text
AUTH WALL:                 ON
HYDRATE BEFORE SIGN-IN:    NO
INVESTMENT SERVER FNS:     authMiddleware
EXECUTE_FULL_100:          NO
V24_OPERATOR_ENABLED:      false
FULL100 RERUN THIS TURN:   NO
CI:                        SUCCESS 33869680618
LAST VERIFIED:             6968c7b github-actions 2026-09-04T11:56:30Z
PRODUCTION ALIAS:          https://tenbagger-lite.vercel.app  200
FAKE DEMO:                 0
```

다음 조사는 전체 100 재실행이 아니라 staleness / Research Gaps / 운영자가 고른 종목이다.

---

## Definition of Done

- [x] `VITE_AUTH_ENABLED=true`
- [x] `migrations/0001_auth.sql` 복사 (원본과 byte-identical)
- [x] `/api/auth/$` + `/login`
- [x] SignInGate before HydrateGate
- [x] UserButton
- [x] persist + researchTicker `authMiddleware`
- [x] EXECUTE_FULL_100 유지 false
- [x] V24_OPERATOR_ENABLED 유지 false
- [x] typecheck / lint / tests / build
- [x] GitHub Actions SUCCESS on hardening SHA
- [x] LAST VERIFIED 는 그 SHA 만
- [x] 프로덕션 에일리어스가 auth-on 빌드 자산을 서빙
- [x] 시크릿 / `data/` / `AGENTS.md` / `.grok/skills` / `startup.sh` 미커밋
