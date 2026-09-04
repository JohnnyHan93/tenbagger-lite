# IDT 투자발견 v2.4 완료 보고서

작성일: 2026-09-04  
제품: IDT 투자발견  
범위: Full 100 통제 실행 (인가된 1회 배치) + 실행 잠금 복구  
Full 100: **실행 완료 후 잠금 복구** (`EXECUTE_FULL_100 = NO`, `V24_OPERATOR_ENABLED = false`)

`docs/COMPLETION_v2.3.md` / `docs/COMPLETION_v2.3.1.md` / `docs/COMPLETION_v2.3.2.md` 는 수정하지 않았다.

리더 표와 커버리지 원본: [`docs/FULL100_v2.4_REPORT.json`](./FULL100_v2.4_REPORT.json)

---

## A. RUN

```text
v2.4 FULL 100 CONTROLLED EXECUTION
PASS

Full100 Run:
PASS

Run ID:
run_4e0qh36xkgya

Type:
INITIAL_BATCH

Started:
2026-09-04T07:49:00.054Z

Completed:
2026-09-04T08:21:22.455Z

Duration:
1942s (32분 22초)
```

한 줄: 남은 97종목을 실제 조사 파이프라인으로 채웠고, 점수를 조작하지 않았으며, 배치가 끝난 뒤 실행 권한을 다시 잠갔다.

---

## B. UNIVERSE

실행 전 스냅샷 (2026-09-04T07:48:58Z):

```text
Sample100:            100
US:                   50
KR:                   50
Analyzed:             3
Remaining:            97
Existing Sample100:   INOD / 005930.KS 삼성전자 / 105560.KS KB금융
Smoke12 extra:        9
Fake demo:            0
DB companies:         109
DB analyses:          12
DB evidences:         68
research_runs:        0
research_jobs:        0
```

실행 후:

```text
Sample100:            100
US:                   50
KR:                   50
Existing before run:  3
Jobs created:         97
Analyzed:             100
Remaining:            0
Fake demo:            0
Smoke extra:          9  (196170.KQ, 267260.KS, 356680.KQ, ASTS, JPM, MSFT, NVDA, PLD, UNH)
DB companies:         109
DB analyses:          109
DB evidences:         1577
research_runs:        1
research_jobs:        97
```

잡 목록에 INOD / 005930.KS / 105560.KS 는 없다. 기존 3건은 재조사하지 않았다. 유니버스 밖 Smoke 9건도 삭제·재조사하지 않았다.

---

## C. JOB RESULTS

```text
COMPLETE:             0
PARTIAL:              0
RESEARCH_REQUIRED:    97
FAILED:               0
CANCELLED:            0
Retries:              0
Max attempts:         1
```

97건 모두 터미널 상태. 운영상 완료 정의(모든 잡이 COMPLETE / PARTIAL / RESEARCH_REQUIRED / FAILED / CANCELLED)를 충족한다.

`RESEARCH_REQUIRED` 97건은 정직한 결과다. Quality 70의 3Y Revenue CAGR · Growth Acceleration 등이 전 종목에서 N/A 이고, 이를 COMPLETE로 채우지 않았다.

---

## D. AI

```text
AI enabled:
YES

Provider:
grok-4.5

Grok successful:
97 / 97

Grok fallback used:
0  (97 신규 잡 기준)

LLM hard failures:
0

Preserved three provider:
filings+profile  (INOD, 삼성전자, KB금융 — 이번 배치에서 재호출하지 않음)
```

Grok 실패 시 기존 heuristic / filings / profile 폴백을 유지한다. 이번 97건은 폴백 없이 grok-4.5 초안이 스키마 검증을 통과했다.

시크릿·프롬프트는 기록하지 않는다.

---

## E. COVERAGE

조작 없이 관측한 값. 랭킹을 보고 가중치를 바꾸지 않았다.

```text
X-Bagger Avg:     89.6%
Oversold Avg:     100.0%
Quality Avg:      27.3%
Median Overall:   73.5%

US  n=50
  X-Bagger  98.4%
  Oversold  100.0%
  Quality   20.5%
  Overall   73.0%

KR  n=50
  X-Bagger  80.8%
  Oversold  100.0%
  Quality   34.2%
  Overall   71.7%
```

Quality 커버리지가 낮은 것은 3Y CAGR 등 필수 시계열이 비어 있기 때문이다. N/A를 0이나 추정으로 채우지 않았다.

### Adapter

| Adapter | N | Avg coverage | COMPLETE | PARTIAL | RESEARCH_REQUIRED | FAILED |
|---|---:|---:|---:|---:|---:|---:|
| Software | 23 | 73.5% | 0 | 0 | 23 | 0 |
| Semiconductor | 9 | 68.7% | 0 | 0 | 9 | 0 |
| Industrial | 16 | 70.6% | 0 | 0 | 16 | 0 |
| Healthcare | 3 | 73.5% | 0 | 0 | 3 | 0 |
| Financial | 5 | 78.5% | 0 | 0 | 5 | 0 |
| REIT | 0 | — | 0 | 0 | 0 | 0 |
| Biotech | 10 | 70.3% | 0 | 0 | 10 | 0 |
| Other | 31 | 72.7% | 0 | 0 | 31 | 0 |
| Telecom | 3 | 75.7% | 0 | 0 | 3 | 0 |

Sample100 안에 REIT 멤버는 없다. PLD는 Smoke extra로 유니버스 밖이다.

---

## F. EVIDENCE

```text
Sample100 evidence graph:  1523
  TIER_1:         201
  TIER_2:         412
  TIER_3:         910
  MANUAL:         0
  ACTIVE:         1523
  STALE:          0
  CONFLICTED:     0
  INVALIDATED:    0

DB evidences (incl. extra Smoke 9):  1577
```

### Research gaps (빈도 + 엔진 영향)

| Field | Engine | Impact | N / 100 |
|---|---|---|---:|
| 3Y Revenue CAGR | quality | HIGH | 100 |
| Growth Acceleration | quality | HIGH | 100 |
| ROIC | quality | HIGH | 95 |
| AR Growth Gap | quality | HIGH | 90 |
| OP Growth | quality | HIGH | 50 |
| Profit Growth Leverage | quality | HIGH | 50 |
| Margin Change | quality | HIGH | 50 |
| Operating Leverage | quality | HIGH | 50 |
| Gross Margin | quality | HIGH | 45 |
| Inventory Growth Gap | quality | HIGH | 43 |
| Interest Coverage | quality | HIGH | 36 |
| 시장 성장·TAM | xbagger | HIGH | 27 |

다음 조사 우선순위용이다. 매수 신호가 아니다.

---

## G. DATA INTEGRITY

```text
Orphan analyses:                    0
Orphan Evidence:                    0
Duplicate latest per company:       0
Successful jobs without analysis:   0
Analysis without company:           0
Duplicate active Full100 run:       0
```

재시작 후 유니버스·점수·Evidence·런/잡은 DB에 남는다. 투자 데이터는 localStorage에 두지 않는다.

---

## H. REGRESSION

로컬 (Grok Builder):

```text
Typecheck:        PASS
Lint:             PASS
Tests:            PASS
  App:            172 / 0 fail
  Platform:       195 / 0 fail
  Total:          367 / 0 fail
Production Build: PASS
```

회귀 항목:

```text
Smoke12 extra 9:     preserved
INOD / 005930 / 105560: preserved (not re-jobbed)
Fake demo:           0
Sample100:           100
CFO / FCF:           unchanged (v2.3)
Transactional persist: unchanged
Three engines:       independent
EXECUTE_FULL_100:    NO
V24_OPERATOR_ENABLED: false
Queue UI:            LOCKED / 실행기 READY / 권한 NO
```

조사 큐는 시작 버튼이 없다. 운영자 경로도 잠겼으므로 동일 배치를 다시 돌릴 수 없다.

---

## I. EXECUTION LOCK

```text
EXECUTE_FULL_100 = false     (소스 플래그, 전 구간 유지)
V24_OPERATOR_ENABLED = false (인가 배치 종료 후 잠금)
processFull100Chunk:         플래그 없으면 FULL100_EXECUTION_DISABLED
v24Start / v24Chunk / v24ResearchOne: OPERATOR_DISABLED
```

이번 실행만 임시 운영자 경로(`executeEnabled: true`, `useAi: true`)를 썼다. 소스의 `EXECUTE_FULL_100` 을 true 로 남기지 않았다. 테스트 `keeps EXECUTE_FULL_100 off` / `flag off creates 0 jobs` / `keeps v2.4 operator locked` 는 통과했다.

청크 크기 3. 동일 클래스 실패 3연속이면 PAUSE. 이번 런에서는 시스템 실패가 없어 일시정지하지 않았다.

---

## J. RESEARCH VIEWS

엔진을 합산한 Buy Score 는 없다. 점수가 높아도 커버리지 < 70% 이면 **EARLY SIGNAL / RESEARCH REQUIRED**.

Research Priority = 어디에 조사 시간을 더 쓸지. 무엇을 살지가 아니다.

### 1. X-Bagger Research Leaders

| Ticker | Company | Score | Coverage | Confidence | Status | Key Evidence | Primary Risk | Top Gap | Note |
|---|---|---:|---:|---|---|---|---|---|---|
| INOD | Innodata Inc. | 67.5 | 67.1% | Medium | RR | TIER_1 · 연간 매출 $170.46M → $251.66M (48%) | 고객 검증 전 단계 | 3Y Revenue CAGR | preserved |
| ANAB | AnaptysBio | 65.2 | 73.5% | Medium | RR | TIER_1 · 연간 매출 $91.28M → $234.60M (157%) | 소수 파트너 로열티 집중 | 3Y Revenue CAGR | |
| ZVRA | Zevra Therapeutics | 65.2 | 69.5% | Medium | RR | TIER_1 · 연간 매출 $23.61M → $106.47M (351%) | 희귀질환 환자 풀 한도 | 시장 성장·TAM | |
| IONQ | IonQ | 64.4 | 73.5% | Medium | RR | TIER_1 · 연간 매출 $43.07M → $130.02M (202%) | 이미 고평가 | 3Y Revenue CAGR | |
| PAYS | Paysign | 63.6 | 73.7% | Medium | RR | TIER_1 · 연간 매출 $58.38M → $82.03M (40%) | 헬스케어 결제 규제 | 3Y Revenue CAGR | |
| 259960.KS | 크래프톤 | 63.6 | 77.8% | Medium | RR | TIER_1 · 연간 매출 2.71조 → 3.33조 (23%) | 히트작 의존 | 3Y Revenue CAGR | |
| MAX | MediaAlpha | 62.8 | 73.5% | Medium | RR | TIER_1 · 연간 매출 $864.70M → $1.11B (29%) | 보험 광고 사이클 | 3Y Revenue CAGR | |
| RIGL | Rigel Pharmaceuticals | 62.5 | 67.6% | Medium | RR | TIER_1 · 연간 매출 $179.28M → $294.28M (64%) | 신제품 채택·경쟁 | 시장 성장·TAM | |

X-Bagger 최고점도 70 미만이라 EARLY SIGNAL 배너는 달지 않았다. 커버리지가 70%를 밑도는 행은 그대로 낮은 확신으로 읽는다.

### 2. Oversold Opportunity Leaders

| Ticker | Company | Score | Coverage | Confidence | Status | Key Evidence | Primary Risk | Top Gap | Note |
|---|---|---:|---:|---|---|---|---|---|---|
| RIGL | Rigel Pharmaceuticals | 7.50 | 67.6% | Medium | RR | TIER_1 · 연간 매출 $179.28M → $294.28M (64%) | 신제품 채택·경쟁 | 시장 성장·TAM | EARLY SIGNAL |
| 000990.KS | DB하이텍 | 7.50 | 61.8% | Low | RR | TIER_1 · 연간 매출 1.13조 → 1.40조 (24%) | 고객·점유율 미확인 | 시장 성장·TAM | EARLY SIGNAL |
| 064350.KS | 현대로템 | 7.50 | 65.1% | Medium | RR | TIER_1 · 연간 매출 4.38조 → 5.84조 (33%) | 10x 수학 불성립 | 시장 성장·TAM | EARLY SIGNAL |
| 015760.KS | 한국전력 | 7.45 | 77.8% | Medium | RR | TIER_1 · 연간 매출 93.40조 → 97.43조 (4%) | 이자·차환 부담 | 3Y Revenue CAGR | |
| 009540.KS | HD한국조선해양 | 7.45 | 61.8% | Low | RR | TIER_1 · 연간 매출 25.54조 → 29.93조 (17%) | 조선 사이클 | 시장 성장·TAM | EARLY SIGNAL |
| EVER | EverQuote | 7.35 | 73.7% | Medium | RR | TIER_1 · 연간 매출 $500.19M → $692.52M (38%) | 보험 리드 단가 | 3Y Revenue CAGR | |
| PGY | Pagaya | 7.15 | 73.7% | Medium | RR | TIER_1 · 연간 매출 $1.00B → $1.26B (26%) | 신용 사이클 | 3Y Revenue CAGR | |
| QNST | QuinStreet | 7.05 | 73.5% | Medium | RR | TIER_1 · 연간 매출 $1.09B → $1.29B (18%) | 저마진 전이 | 3Y Revenue CAGR | |

### 3. Quality Leaders

| Ticker | Company | Score | Coverage | Confidence | Status | Key Evidence | Primary Risk | Top Gap | Note |
|---|---|---:|---:|---|---|---|---|---|---|
| RDVT | Red Violet | 89.1 | 73.7% | Medium | RR | TIER_1 · 연간 매출 $75.19M → $90.25M (20%) | 멀티플 수축 | 3Y Revenue CAGR | |
| RIGL | Rigel Pharmaceuticals | 87.5 | 67.6% | Medium | RR | TIER_1 · 연간 매출 $179.28M → $294.28M (64%) | 신제품 채택·경쟁 | 시장 성장·TAM | EARLY SIGNAL |
| PAYS | Paysign | 87.3 | 73.7% | Medium | RR | TIER_1 · 연간 매출 $58.38M → $82.03M (40%) | 헬스케어 결제 규제 | 3Y Revenue CAGR | |
| 064350.KS | 현대로템 | 86.7 | 65.1% | Medium | RR | TIER_1 · 연간 매출 4.38조 → 5.84조 (33%) | 10x 수학 불성립 | 시장 성장·TAM | EARLY SIGNAL |
| 039030.KS | 이오테크닉스 | 85.6 | 61.8% | Low | RR | TIER_1 · 연간 매출 3209억 → 3809억 (19%) | 수주 파이프라인 미확인 | 시장 성장·TAM | EARLY SIGNAL |
| INOD | Innodata Inc. | 85.5 | 67.1% | Medium | RR | TIER_1 · 연간 매출 $170.46M → $251.66M (48%) | 고객 검증 전 단계 | 3Y Revenue CAGR | EARLY SIGNAL |
| EVER | EverQuote | 85.5 | 73.7% | Medium | RR | TIER_1 · 연간 매출 $500.19M → $692.52M (38%) | 보험 리드 단가 | 3Y Revenue CAGR | |
| PATH | UiPath | 85.5 | 73.7% | Medium | RR | TIER_1 · 연간 매출 $1.43B → $1.61B (13%) | 중성장 고착 | 3Y Revenue CAGR | |

### 4. Cross-Strategy Research Priority

조사 시간을 어디에 더 쓸지. 매수 추천이 아니다.

| Ticker | Company | Priority | Coverage | Confidence | Status | Key Evidence | Primary Risk | Top Gap | Note |
|---|---|---:|---:|---|---|---|---|---|---|
| INOD | Innodata Inc. | 78 | 67.1% | Medium | RR | TIER_1 · 연간 매출 $170.46M → $251.66M (48%) | 고객 검증 전 단계 | 3Y Revenue CAGR | EARLY SIGNAL |
| RIGL | Rigel Pharmaceuticals | 77 | 67.6% | Medium | RR | TIER_1 · 연간 매출 $179.28M → $294.28M (64%) | 신제품 채택·경쟁 | 시장 성장·TAM | EARLY SIGNAL |
| EVER | EverQuote | 73 | 73.7% | Medium | RR | TIER_1 · 연간 매출 $500.19M → $692.52M (38%) | 보험 리드 단가 | 3Y Revenue CAGR | |
| RDVT | Red Violet | 71 | 73.7% | Medium | RR | TIER_1 · 연간 매출 $75.19M → $90.25M (20%) | 멀티플 수축 | 3Y Revenue CAGR | |
| PAYS | Paysign | 69 | 73.7% | Medium | RR | TIER_1 · 연간 매출 $58.38M → $82.03M (40%) | 헬스케어 결제 규제 | 3Y Revenue CAGR | |
| PATH | UiPath | 68 | 73.7% | Medium | RR | TIER_1 · 연간 매출 $1.43B → $1.61B (13%) | 중성장 고착 | 3Y Revenue CAGR | |
| DSP | Viant Technology | 65 | 73.7% | Medium | RR | TIER_1 · 연간 매출 $289.24M → $344.20M (19%) | CTV 경쟁 | 3Y Revenue CAGR | |
| MITK | Mitek Systems | 65 | 73.7% | Medium | RR | TIER_1 · 연간 매출 $172.08M → $179.69M (4%) | 한 자릿수 성장 정체 | 3Y Revenue CAGR | |

---

## K. CI

LAST VERIFIED 는 GitHub Actions SUCCESS SHA `e82507d` 를 가리킨다.

```text
Typecheck:          PASS
Lint:               PASS
Tests:              PASS (App 172 / Platform 195 / Total 367, 0 fail)
Production Build:   PASS

GitHub Actions:
SUCCESS
  run: 33854158716
  sha: e82507d03364ddc06ca21c220f31f031a7159ec3
  url: https://github.com/JohnnyHan93/tenbagger-lite/actions/runs/33854158716
  completed: 2026-09-04T08:38:58Z
```

---

## L. FINAL STATE

```text
FULL100 DATASET:
RESEARCHED

EXECUTOR:
READY

EXECUTION:
LOCKED

EXECUTE_FULL_100:
NO

SAMPLE100 = 100
INITIAL EXISTING = 3
NEW JOBS = 97
COMPLETE = 0
PARTIAL = 0
RESEARCH_REQUIRED = 97
FAILED = 0
CANCELLED = 0
AI RESEARCH = ENABLED (batch complete; lock restored)
DATABASE INTEGRITY = PASS
FAKE DEMO = 0
```

다음 조사는 전체 100 재실행이 아니라 staleness / Research Gaps / 사용자가 고른 종목 / 중대한 이벤트에 따른다.

---

## Definition of Done

- [x] Preflight passed (executor + providers live)
- [x] exactly 97 initial jobs created
- [x] existing 3 excluded
- [x] useAi=true for actual batch research
- [x] Grok failure falls back honestly (0 fallbacks this run)
- [x] chunk size <= 3 by default
- [x] retries bounded (max 3; this run used 1)
- [x] persistent queue used
- [x] no duplicate Full100 run
- [x] no duplicate successful snapshots
- [x] all 97 jobs reach terminal status
- [x] DB integrity checked
- [x] fresh reload persistence checked (durable PGLite + checkpoint)
- [x] coverage report generated
- [x] adapter report generated
- [x] Evidence report generated
- [x] research-gap report generated
- [x] rankings do not merge engines
- [x] no score manipulation
- [x] Smoke12 preserved
- [x] INOD preserved
- [x] Sample100 remains exactly 100
- [x] fake demo remains 0
- [x] typecheck / lint / tests / build (local PASS: 367 tests, 0 fail)
- [x] GitHub Actions green ([run 33854158716](https://github.com/JohnnyHan93/tenbagger-lite/actions/runs/33854158716))
- [x] EXECUTE_FULL_100 restored to NO
- [x] Full100 cannot automatically run again

---

## COMMIT

| 항목 | 값 |
|---|---|
| Repository | [JohnnyHan93/tenbagger-lite](https://github.com/JohnnyHan93/tenbagger-lite) |
| Branch | `main` |
| Code commit | [`e82507d03364ddc06ca21c220f31f031a7159ec3`](https://github.com/JohnnyHan93/tenbagger-lite/commit/e82507d03364ddc06ca21c220f31f031a7159ec3) |
| GitHub Actions | [run 33854158716](https://github.com/JohnnyHan93/tenbagger-lite/actions/runs/33854158716) SUCCESS |
| LAST VERIFIED | `e82507d` source=`github-actions` @ 2026-09-04T08:38:58.000Z |
| 시크릿 | `.env` 및 API/DB 키 미포함. `data/` PGLite·checkpoint 미커밋. `AGENTS.md` / `.grok/skills/` 미커밋 |

LAST VERIFIED 는 GitHub Actions 가 성공한 SHA 만 가리킨다.
