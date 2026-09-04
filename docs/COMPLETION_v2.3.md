# IDT 투자발견 v2.3 완료 보고서

작성일: 2026-09-04  
제품: IDT 투자발견  
범위: Pre-Full100 Hardening (P0.5-1 … P0.5-8)  
Full 100: **실행하지 않음** (`EXECUTE_FULL_100 = NO`)

---

## A. STATUS

```text
v2.3:
PASS

Full100 Started:
NO
```

한 줄: Full 100을 안전하게 돌릴 수 있는 실행기·큐·트랜잭션 저장·CFO/FCF 분리를 넣었다. 배치는 시작하지 않았다.

---

## B. COMMIT

| 항목 | 값 |
|---|---|
| Repository | [JohnnyHan93/tenbagger-lite](https://github.com/JohnnyHan93/tenbagger-lite) |
| Branch | `main` |
| Commit | [`65e301929e157a74ec222d8cc5b437edea08f96d`](https://github.com/JohnnyHan93/tenbagger-lite/commit/65e301929e157a74ec222d8cc5b437edea08f96d) |
| Message | Harden IDT v2.3 pre-Full100 reliability. |
| 파일 | 36 (추가 12 / 수정 24) |
| Diff | +2,168 / −77 |
| 시크릿 | `.env` 및 API/DB 키 미포함. `.env.example`만 허용 |

문서 커밋(이 파일 + LAST VERIFIED SHA)이 이어서 `main`에 올라간다.

---

## C. CFO / FCF

| 항목 | 결과 |
|---|---|
| FinancialSnapshot separated | PASS — `cfo`, `fcf`, `fcfSource` |
| Nasdaq OCF mapping | PASS — `Net Cash Flow-Operating` → `cfo`. CAPEX 없으면 `fcf = null` |
| Derived CFO fallback removed | PASS — `cfo = extras.cfo ?? financials.cfo`. FCF를 CFO로 쓰지 않음 |
| Quality affected factors verified | PASS |

Quality:

- Q17 / Q18 / Q22 / Q44 → CFO. CFO 없으면 N/A
- Q19 / Q24 / Q57 → FCF. FCF 없으면 N/A
- Q20 / Q21 / Q32 / Q41 → MANUAL_ONLY (Q41은 ROIC 복사 아님)

커버리지가 떨어져도 점수를 올리지 않는다. 잘못된 프록시 = 0.

---

## D. PERSISTENCE

| 항목 | 결과 |
|---|---|
| Transactional save | PASS — `saveAnalysisTransaction()` BEGIN company + analysis + evidence + optional job / COMMIT |
| Rollback test | PASS — evidence #2 실패 시 company/analysis/evidence 0행 |
| Save failure visibility | PASS — `IDLE / SAVING / SAVED / SAVE_FAILED`, 배너 + 다시 시도. `.catch(() => undefined)` 제거 |

저장 실패 문구: 「저장 실패 / 분석 결과가 DB에 저장되지 않았습니다. 다시 시도하십시오.」 메모리 결과는 유지한다.

---

## E. QUEUE

| 항목 | 결과 |
|---|---|
| research_runs table | PASS — `migrations/0003_research_queue.sql` |
| research_jobs table | PASS |
| Persistent | PASS — 새로고침/재시작 후에도 남음 |
| Retry | PASS — 429 / timeout / 일시 실패, 최대 3회 |
| Resume | PASS — RESEARCHING → QUEUED. 완료 4건은 재실행하지 않음 |
| Pause | PASS — 신규 스케줄 중단, 진행 중 잡은 종료 허용 |
| Cancel | PASS — 완료 분석 삭제 없음 |

부팅 시 stale job만 복구한다. Full 100을 자동 시작하지 않는다.

---

## F. FULL100 RUNNER

| 항목 | 결과 |
|---|---|
| Runner implemented | PASS — `src/lib/research/runner.ts` |
| Concurrency | 3 (허용 2–4) |
| Flag protection | PASS — `EXECUTE_FULL_100 = false` → `FULL100_EXECUTION_DISABLED`. job 생성 없음, provider 호출 없음 |
| One job = one snapshot | PASS — 인프라 재시도는 스냅샷을 늘리지 않음 |
| Execution performed | **NO** |

기존 Sample 분석(INOD, 삼성전자, KB금융)은 재조사 대상으로 넣지 않는다. 남은 유니버스 97.

---

## G. PREFLIGHT

LIVE CHECK:

- DB 연결
- Sample Universe 100 / US 50 / KR 50
- Fake demo 0
- 기존 Sample 리서치 보존
- Smoke 12 보존
- research_jobs / research_runs
- 활성 Full-100 충돌
- EXECUTE_FULL_100
- 시세/공시 경로 (xAI는 선택)

LAST VERIFIED BUILD STATE (`src/lib/research/verified-build.ts`):

- Typecheck
- Lint
- Tests
- Production Build
- commitSha `65e3019` @ 2026-09-04T05:10:00.000Z

하드코드된 live PASS는 없다. 브라우저에서 `npm test`를 돌리는 것처럼 보이지 않는다.

---

## H. REGRESSION

| 항목 | 값 |
|---|---|
| Existing Smoke 12 preserved | YES (자동 Refresh 없음) |
| INOD preserved | YES |
| Sample 100 count | 100 (US 50 / KR 50) |
| Analyzed in Sample100 | 3 |
| Remaining | 97 |
| Fake demo | 0 |
| 유니버스 밖 Smoke | 9 (유지) |

Smoke 12: MSFT, NVDA, INOD, ASTS, UNH, JPM, PLD, 005930, 267260, 196170, 105560, 356680.

---

## I. VALIDATION

```text
Typecheck:          PASS   (npx tsc --noEmit)
Lint:               PASS   (npm run lint, 0 errors)
Tests:              PASS
  App:              146 / 0 fail
  Platform/scripts: 195 / 0 fail
  Total:            341 / 0 fail
Production Build:   PASS   (npm run build)
GitHub CI:          added  .github/workflows/ci.yml
                    npm ci, typecheck, lint, test, build
                    no paid research, no secrets
```

신규 회귀:

- CFO/FCF A/B/C + Quality Q17/Q19 분리
- 트랜잭션 롤백
- 영속 job 복구
- 429→timeout→성공, 시도 3, 스냅샷 1
- IDENTITY_FAILURE 비재시도
- persist 실패 → job COMPLETE 아님
- resume 10건 중 완료 4건 제외
- EXECUTE_FULL_100=false → FULL100_EXECUTION_DISABLED
- DB unavailable / universe 99 → ready false

---

## J. FINAL STATE

```text
P0 Core                    PASS
CFO / FCF Integrity        PASS
Transactional Save         PASS
Persistent Queue           PASS
Batch Runner               PASS
Retry / Resume             PASS
Real Preflight             PASS
Save Failure Visibility    PASS
Tests                      PASS
Typecheck                  PASS
Lint                       PASS
Production Build           PASS
Full 100 Executor          READY
EXECUTE_FULL_100           NO
Full 100 Started           NO
```

```text
FULL 100 EXECUTOR READY

EXECUTE_FULL_100 = NO

FULL 100 NOT STARTED
```

Full 100은 별도 승인 후에만 시작한다.
