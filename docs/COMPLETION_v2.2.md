# IDT 투자발견 v2.2 완료 보고서

작성일: 2026-09-04  
제품: IDT 투자발견  
범위: P0 수리 + Smoke 12 보존 + 리서치 검증 + GitHub `main` 동기화  
Full 100: **실행하지 않음** (`EXECUTE_FULL_100 = NO`)

---

## 1. 한 줄 요약

Workspace의 동작하는 v2.2를 Source of Truth로 GitHub `JohnnyHan93/tenbagger-lite` `main`에 올렸다.  
기존 INOD·Smoke 12 분석 구조는 유지했고, 유료 Full 100 배치는 시작하지 않았다.

---

## 2. GitHub 제출

| 항목 | 값 |
|---|---|
| Repository | [JohnnyHan93/tenbagger-lite](https://github.com/JohnnyHan93/tenbagger-lite) |
| Branch | `main` |
| Commit | [`4ad7f8cbded31a391ff77ec08188c2cdd7a444db`](https://github.com/JohnnyHan93/tenbagger-lite/commit/4ad7f8cbded31a391ff77ec08188c2cdd7a444db) |
| Message | Ship IDT v2.2 P0 repair and research validation. |
| 파일 | 77 (추가 28 / 수정 49 / 삭제 0) |
| Diff | +5,884 / −350 |
| 시크릿 | `.env` 및 실제 API/DB 키 미포함. `.env.example`만 포함 |

원격 `origin/main` SHA는 로컬 `4ad7f8c`와 일치한다. 푸시 후 GitHub에서 파일을 다시 읽어 아래 항목을 확인했다.

---

## 3. 실행 상태

```text
P0                 PASS
Smoke 12           PASS (기존 12건 보존, 자동 Refresh 없음)
Full 100           READY · EXECUTE_FULL_100 = NO
Production build   PASS
External           PROTECTED / NOT PUBLICLY VERIFIED
```

---

## 4. 커밋 직전 검증

```text
Typecheck          PASS   (npx tsc --noEmit)
Lint               PASS   (npm run lint)
App tests          124 / 0 fail
Platform tests     195 / 0 fail
Total              319 / 0 fail
Production build   PASS   (npm run build)
Secrets in client  none
```

---

## 5. 유니버스

| 항목 | 값 |
|---|---|
| Sample Research 100 | 100 (US 50 / KR 50), 신원만 시드, 점수 없음 |
| 분석됨 | 12 |
| 유니버스 안 분석 | 3 (INOD, 삼성전자, KB금융) |
| 유니버스 밖 Smoke | 9 (유지) |
| 남은 조사 | 97 |
| Fake demo | 0 |
| INOD | 보존 |

---

## 6. 리서치 상태 (저장된 Smoke 12)

```text
Complete            0
Partial            12
Research Required  12
Failed              0
```

미완성은 실패가 아니다. 없는 숫자를 채워 완료로 바꾸지 않았다.

커버리지 (저장된 스냅샷 기준):

```text
X-Bagger   62%
Oversold   71%
Quality    12%
US 분석 7 / KR 분석 5
Quality KR 0%  — 현재 스냅샷 기준 정직한 결과
```

---

## 7. GitHub `main` 재확인

푸시 후 원격 파일을 다시 읽었다.

| 항목 | 상태 | 근거 |
|---|---|---|
| DB Source of Truth | 있음 | `migrations/0002_idt_domain.sql`, `src/lib/persist/repo.ts`. Zustand persist 키 `idt-v21-prefs`는 settings only |
| Domain migrations | 있음 | `companies`, `analyses`(insert-only), `evidences`, `universes`, `watchlist`, `app_kv` |
| `saveFromDraft` | 있음 | `runSnapshotFromDraft` — `saveFromQuote`로 초안을 버리지 않음 |
| Fake demo runtime | 0 | `purgeFakeDemo` + identity seed. Sample Six는 테스트 픽스처만 |
| Sample Research 100 | 있음 | `src/lib/sample-research-100.ts` (INOD 포함, 점수 없음) |
| KR annual pipeline | 있음 | Naver 연간 JSON 1순위 + WiseReport 첫 IFRS연결 연간 블록 |
| Research Required / Gaps | 있음 | `src/components/research-gaps.tsx`, 종목 Gaps 탭 |
| Persistent queue | 있음 | `buildUniverseJobs`가 DB 스냅샷에서 유도. 배치 미실행 |
| Immutable history | 있음 | Refresh/override는 새 스냅샷 insert |
| `EXECUTE_FULL_100` | **NO** | `src/lib/research/jobs.ts` → `export const EXECUTE_FULL_100 = false` |

---

## 8. 이번 작업에서 고친 P0 / v2.2

### P0

- 투자 데이터의 Source of Truth를 localStorage `idt-v2`에서 **Postgres / PGLite**로 이전
- `saveFromDraft()`가 Grok 초안(점수·evidence·catalyst)을 보존
- Sample Six 가상 데이터 런타임 시드 제거
- `src/lib/samples.ts`는 TEST_FIXTURE 전용 (store/hydrate가 import하지 않음)
- ANALYZE / Refresh는 회사 + 스냅샷을 즉시 DB insert
- 이력은 불변. 덮어쓰지 않음

### 리서치 검증 (v2.2)

- 한국 연간: Naver `finance/annual` (억원, 컨센서스·올해 전망 제외)
- WiseReport: 첫 번째 IFRS연결 연간 블록만 사용. 분기 헤더 중복으로 파싱이 비던 문제 수정
- ROE를 ROIC로 쓰지 않음. 연결/별도, 회계연도 기록
- RESEARCH REQUIRED가 커버리지·빈 팩터·다음 출처를 설명
- Gaps 탭: 영향도 순 정렬 (매수 신호 아님)
- 조사 큐: US vs KR 커버리지, 어댑터 표, 미분석 97종 목록, 비용 안전 문구
- KR 티커 별칭: `005930` ↔ `005930.KS`

### 한국 Quality N/A

기존 스냅샷의 Quality N/A는 **유효한 미완**이다.  
삼성전자 FY2025 연결 매출 3,336,059억은 Naver와 WiseReport가 일치하지만, 점수를 채우려고 기존 12건을 자동 Refresh하지 않았다. 종목에서 Refresh하면 새 스냅샷이 추가되고 이전 기록은 남는다.

---

## 9. 추가된 파일

```text
.env.example
migrations/0002_idt_domain.sql
src/lib/sample-research-100.ts
src/lib/persist/actions.ts
src/lib/persist/repo.ts
src/lib/persist/freshness.ts
src/lib/persist/p0.test.ts
src/lib/persist/demo.test.ts
src/lib/research/jobs.ts
src/lib/research/gaps.ts
src/lib/research/gaps.test.ts
src/lib/research/coverage-report.ts
src/lib/research/identity.ts
src/components/research-gaps.tsx
src/lib/bootstrap.ts
src/lib/demo.ts
src/lib/xlsx.ts
src/lib/engines/diff.ts
src/lib/engines/industry.test.ts
docs/QUALITY_70_FACTOR_AUDIT.md
scripts/cleanup-demo-data.mjs
scripts/copy-pglite-assets.mjs
scripts/smoke-12.mjs
scripts/smoke-12-verify.mjs
scripts/smoke-12-evidence.mjs
scripts/smoke-12-resume.mjs
scripts/smoke-12-resume-refresh.mjs
scripts/smoke-12-retry.mjs
```

## 10. 수정된 핵심 파일

```text
src/lib/store.ts
src/components/hydrate.tsx
src/lib/research/quote-parse.ts
src/lib/research/quote-fetch.ts
src/lib/engines/run.ts
src/routes/queue.tsx
src/routes/company.$ticker.tsx
src/routes/index.tsx
src/lib/samples.ts          # 런타임 시드 제거, 테스트 전용 주석
README.md
docs/BUILD_STATE.md
docs/CHANGELOG.md
.grok/app-env.json          # database: true, auth off
```

가상 회사 런타임 시드는 제거했다. `samples.ts` 파일 자체는 테스트용으로 남겼다.

---

## 11. 하지 않은 것

- Full 100 배치 실행
- Smoke 12 일괄 Refresh
- 엔진 합산 / 매수 점수화
- 한국 재무 추정·날조
- ROE → ROIC 대리
- 프로덕션 공개 (Deployment Protection 유지)
- `.env` 및 실제 키 커밋

---

## 12. 다음에 Full 100을 돌리려면

채팅에서 **Full 100 실행**과 `EXECUTE_FULL_100 = YES`를 명시해야 한다.

그때의 규칙:

- 기존 12건은 재호출하지 않음
- 남은 유니버스 97종만 조사
- 유니버스 밖 Smoke 9건 유지
- 큐·재개·부분 실패를 유지
- 실제 시세·공시만 사용. 없는 값은 N/A
- RESEARCH REQUIRED는 실패가 아님

---

## 13. 엔진 버전

| 엔진 | 버전 | 비고 |
|---|---|---|
| X-Bagger | XBG-v2.0 | 0–100, 독립 |
| Oversold | OSM-v2.1 | N/A 재정규화. REIT 일반 P/E 강제 없음 |
| Quality 70 | MFC70-v1.2 | 은행 레버리지/ROIC 강제 없음. 바이오 재고/ROIC 조건부 |
| Lenses | LENS-v1.0 | 오버레이. Quality에 합산하지 않음 |
