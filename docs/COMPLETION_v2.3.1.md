# IDT 투자발견 v2.3.1 완료 보고서

작성일: 2026-09-04  
제품: IDT 투자발견  
범위: Execution wiring & CI repair (P0.5.1-1 … P0.5.1-8)  
Full 100: **실행하지 않음** (`EXECUTE_FULL_100 = NO`)

v2.3.1은 v2.3 이후 독립 GitHub 리뷰에서 확인된 갭을 닫는다.

- production Full100 wiring
- real remaining = 97 initialization
- bounded chunk processor
- run progress synchronization
- preflight hardcoded values
- GitHub CI portability

`docs/COMPLETION_v2.3.md`는 수정하지 않았다.

---

## A. STATUS

```text
v2.3.1:
PASS

Full100 Started:
NO
```

한 줄: 나중에 Full 100을 켤 시작 경로가 DB 워크스페이스·실제 리서치·트랜잭션 저장·청크 3종목에 연결됐다. 배치는 시작하지 않았다.

---

## B. PRODUCTION WIRING

```text
start action loads DB workspace:
YES

Actual remaining:
97

Jobs that would be created:
97

Research dependency connected:
YES

Transactional persist connected:
YES
```

- `startFull100Fn` → `startFull100FromWorkspace()` → `loadWorkspace()` → live preflight → 권한 확인 → `startFull100Research({ companies, snapshots })`
- 빈 배열로 `startFull100Research()`를 호출하지 않는다.
- 기존 Sample 분석 INOD / 005930.KS / 105560.KS 는 초기 잡에서 제외된다.
- `createProductionDeps()`: `executeResearch` → `runSnapshotFromDraft` → `saveAnalysisTransaction` (`persistFinalizesJob: true`)
- 최종 job 상태는 분석 트랜잭션 안에서만 COMPLETE/PARTIAL/RESEARCH_REQUIRED 가 된다.

---

## C. EXECUTION MODEL

```text
Bounded chunk:
YES

Chunk size:
3

Detached background runner:
NO

Resume across process restart:
PASS
```

- `processFull100Chunk(runId)` 한 호출 = 최대 3잡
- Queue 페이지 오케스트레이터는 구현됐으나 `EXECUTE_FULL_100 = false` 에서 동작하지 않는다 (시작 버튼 없음)
- 브라우저를 닫아도 DB가 권위. RESEARCHING → QUEUED 복구
- pause / cancel 은 `research_runs.status` 를 읽는다. 인메모리 Set 은 최적화일 뿐

---

## D. RUN PROGRESS

```text
completed_jobs sync:
PASS

failed_jobs sync:
PASS

run completion:
PASS
```

규칙:

- `completed_jobs` = COMPLETE + PARTIAL + RESEARCH_REQUIRED
- `failed_jobs` = FAILED
- terminal = successful + failed + cancelled
- `terminal == total_jobs` → run `COMPLETE` + `completed_at`
- 회사 1건 실패만으로 run 을 FAILED 로 두지 않는다

예시 회귀: 10잡 / COMPLETE 3 / PARTIAL 2 / RR 2 / FAILED 1 / QUEUED 2 → completed=7, failed=1, RUNNING. 남은 2건 종료 → COMPLETE.

---

## E. PREFLIGHT

```text
providerConfig hardcoded:
NO

executorReady hardcoded:
NO

LIVE fallback fake PASS:
NO
```

- 시세 경로: Yahoo AAPL chart + Naver 005930/basic GET (4s, 429/403 은 reachable). xAI 호출 없음. 분석/증거/히스토리 미변경
- `executorReady` = DB + queue tables + universe 100 + US50 + KR50 + fake 0 + 충돌 없음 + production wiring
- `ready` = executorReady AND EXECUTE_FULL_100 AND providerConfig
- 기대 상태: Executor Ready YES(구조) / Execution Authorized NO / EXECUTE_FULL_100 NO
- Queue LIVE CHECK: live 요청이 없으면 UNKNOWN. static universe 100 을 LIVE PASS 로 쓰지 않는다

---

## F. CI

```text
Fresh GitHub checkout:
PASS (Grok skill tests skipped; VITE_AUTH_ENABLED isolated)

npm ci:
PASS

Typecheck:
PASS

Lint:
PASS

Tests:
PASS
  App:              163 / 0 fail
  Platform/scripts: 191 pass + 4 skip (Grok skill pack absent)
  Total:            358 portable (4 skip on GitHub)

Build:
PASS

GitHub Actions:
SUCCESS
  run: 33845002445
  sha: 20673fd5dee32d3c7834d0d7cbf4e130cdf01fed
  url: https://github.com/JohnnyHan93/tenbagger-lite/actions/runs/33845002445
```

Grok-only 테스트 (`.grok/skills/og/SKILL.md`, `AGENTS.md`) 는 해당 파일이 없는 checkout 에서 skip 한다. `npm run test:grok-platform` 은 빌더용으로 남긴다. `.grok/skills/` 와 `AGENTS.md` 는 커밋하지 않는다.

Auth-off CI (`VITE_AUTH_ENABLED=false`) 에서도 gate-identity 테스트가 통과하도록 스위트를 격리했다.

---

## G. REGRESSION

```text
Smoke12:
12 preserved

INOD:
preserved

Sample100:
100

Analyzed:
3

Remaining:
97

Fake demo:
0
```

CFO/FCF 와 transactional persist 회귀도 green.

- Nasdaq OCF → CFO only. CAPEX 없으면 FCF = null
- Quality Q17/Q18/Q22/Q44 = CFO, Q19/Q24/Q57 = FCF
- evidence #2 강제 실패 → company/analysis/evidence 0행

Smoke 12 자동 Refresh 없음. Full 100 실연구 0건.

---

## H. FINAL STATE

```text
FULL 100 EXECUTOR ACTUALLY READY

EXECUTE_FULL_100 = NO

FULL 100 NOT STARTED

GITHUB CI = GREEN
```

v2.4 FULL 100 CONTROLLED EXECUTION 은 별도 지시 후에만.

---

## I. DEFINITION OF DONE

- [x] startFull100Fn uses authoritative DB workspace
- [x] existing 3 Sample analyses are excluded
- [x] new run would create exactly 97 jobs
- [x] production research dependency is connected
- [x] production transactional persist dependency is connected
- [x] execution uses bounded chunks
- [x] no detached long-running background Promise is required
- [x] run counters synchronize from DB jobs
- [x] terminal run status is persisted
- [x] DB run status governs pause/cancel/resume
- [x] provider preflight is not hardcoded true
- [x] executorReady is not hardcoded true
- [x] Queue UI does not fake LIVE PASS
- [x] default npm test works on fresh GitHub checkout (Grok files skipped)
- [x] Grok-only platform tests do not break repository CI
- [x] GitHub Actions conclusion = success
- [x] Build actually runs in GitHub Actions workflow
- [x] CFO/FCF regressions remain green
- [x] transaction regressions remain green
- [x] Smoke12 preserved
- [x] INOD preserved
- [x] Sample100 remains 100
- [x] Remaining remains 97
- [x] EXECUTE_FULL_100 remains NO
- [x] no real Full100 research executed

---

## J. COMMIT

| 항목 | 값 |
|---|---|
| Repository | [JohnnyHan93/tenbagger-lite](https://github.com/JohnnyHan93/tenbagger-lite) |
| Branch | `main` |
| Wiring commit | [`c11fe76302e379667cdd32bf7874c988d3028c97`](https://github.com/JohnnyHan93/tenbagger-lite/commit/c11fe76302e379667cdd32bf7874c988d3028c97) |
| CI-green commit | [`20673fd5dee32d3c7834d0d7cbf4e130cdf01fed`](https://github.com/JohnnyHan93/tenbagger-lite/commit/20673fd5dee32d3c7834d0d7cbf4e130cdf01fed) |
| GitHub Actions | [run 33845002445](https://github.com/JohnnyHan93/tenbagger-lite/actions/runs/33845002445) SUCCESS |
| LAST VERIFIED | `20673fd` source=`github-actions` @ 2026-09-04T06:43:27.000Z |
| 시크릿 | `.env` 및 API/DB 키 미포함. `AGENTS.md` / `.grok/skills/` 미커밋 |

LAST VERIFIED 는 GitHub Actions 가 성공한 SHA 만 가리킨다. v2.3 SHA `65e3019` 의 GitHub CI 는 실패했으므로 그 SHA 를 GitHub-green 으로 표시하지 않는다.
