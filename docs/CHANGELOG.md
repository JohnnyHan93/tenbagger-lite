## Engine gap fill — per stock, per model

- Company Gaps tab lists missing X / Oversold / Quality items as 자동 vs 직접입력.
- 인터넷에서 채우기 re-fetches quote + filings. Remaining disclosure fields (TAM, share, customers, organic, going concern, R&D, backlog) have inline inputs on the same page.
- Dashboard and engine lists show X·O·Q gap counts. New snapshot; history stays immutable.

## v2.4.8 — Scoring honesty XBG-v2.2 / OSM-v2.3 / MFC70-v1.4

- X-Bagger: TAM·점유율·고객을 테마 키워드나 매출만으로 채점하지 않음. 3Y CAGR가 있으면 F2는 그걸 쓰고, 최근 YoY가 꺾이면 캡. 깊은 영업적자는 F3를 제한. 배수 없으면 F8은 N/A.
- Oversold: 3Y 매출 CAGR·FCF 추세·현금전환을 펀더멘털에 반영. 최근 순이익이 3Y 고점이면 Peak earnings 가산.
- Quality: Yahoo FY 시계열로 Q04 EPS, Q22 3FY CFO 지속, Q35 부채갭, Q38 ΔOP/ΔIC, Q40 PPE 회전, Q42 CAPEX 생산성, Q45 PPE 성장을 자동 채점. 단년 CFO로 Q22를 채우지 않음. 3Y CAGR는 FY 4점이 필요.
- 세 엔진 점수는 합치지 않음. 과거 스냅샷은 불변. `EXECUTE_FULL_100` 잠금.

## Discover fills missing quote inline

- ANALYZE with no market cap no longer sends you to Manual Mode. Enter price / cap / optional financials on the same card and run.

## v2.4.7 — Sample100 complete on Neon

- Full 100 + gap fill finished on `idt.grok.me` Neon. `EXECUTE_FULL_100` stays locked.
- Yahoo / Naver FY series fill Quality cash/growth factors. Remaining counts series, not RESEARCH_REQUIRED.
- Queue exports Full 100 CSV/JSON. Dashboard sanitizes missing tickers. Three engine scores never summed.

## Gap fill remaining no longer stuck at 100

- Remaining is missing Yahoo/Naver FY series (or no timeseries attempt), not `RESEARCH_REQUIRED`.
- Quality 27% / overall < 70% stays honest. After a series save, remaining drops. Already-filled names are skipped on resume.

## Gap fill from Yahoo / Naver series

- Yahoo fundamentals timeseries (FY 매출·영업이익·순이익·CFO·FCF·주식수 + 분기 매출) and Naver annual columns build `FinancialSeries` (TIER_2).
- Quality Q02 / Q07 / Q20 / Q21 / Q54 and cash factors score from that series when present. Missing still N/A, not 0.
- MANUAL_ONLY (Q04 / Q08 / Q32 / Q41 / …) stays N/A. Queue **공백 채우기** re-researches Sample100 names below Quality 55% or without 3 FY points. Neon only. New snapshot; history is not overwritten.
- Full 100 stays locked.

## Full 100 complete — relock + report

- Neon Sample100 batch is done. `EXECUTE_FULL_100` is **false** again so it cannot auto-run.
- Queue shows COMPLETE + coverage (X / Oversold / Quality) and exports `idt-full100.csv` / `idt-full100-report.json`.
- Extra Smoke names outside the 100 stay. Three engine scores are never summed.
- Dashboard no longer crashes on a company row without `ticker` (sanitize workspace on load/merge).

## Full 100 authorized on this Neon

- User typed `EXECUTE_FULL_100`. Flag is **YES**. Queue runs remaining Sample100 on **idt.grok.me Neon only**.
- Already-saved snapshots are skipped. Extra Smoke names (MSFT, NVDA, …) are not in the 100 and are not touched.
- PGLite preview returns `FULL100_EPHEMERAL` and does not fetch quotes. `?run=full100` auto-starts on a durable host.
- v2.4 queue operator (`V24_OPERATOR_ENABLED`) stays locked. Sequential runner matches Smoke 12.

## Smoke 12 on Neon

- Queue can run Smoke 12 (3 Sample100 + 9 extra) without unlocking Full 100.
- Writes only when the backend is Neon. PGLite preview returns `SMOKE12_EPHEMERAL` and does not fetch quotes.
- Existing snapshots are skipped. `?run=smoke12` auto-starts on a durable host.

## CRITERIA-v1 + XBG-v2.1 / OSM-v2.2 / MFC70-v1.3

- Criteria runtime: import / validate / apply / reset JSON (`idt-criteria-v1`). Next ANALYZE uses the active pack. Snapshots store overlayId + versions + hash. Past snapshots stay immutable.
- X-Bagger F10 is Tenx math only. No synthetic `marketCap/20` or default 25% growth. Survival and customer gates are evidence-aware.
- Oversold Value Trap starts at 0. Peak earnings is NONE/POSSIBLE/HIGH. Incomplete Case when F or O is missing. Trap still not in Opp.
- Quality Q37 no longer copies asset turnover. Q70 no longer uses liquidity. FinancialSeries drives Q07 / Q20 / Q21 / Q54. Core vs conditional coverage is stored.
- Full 100 remains locked. Three engine scores are never summed.

## v2.4.6 follow-up — durable analysis writes

- Production Vercel without `DATABASE_URL` no longer treats in-memory PGLite as a successful save.
- After each analysis commit the row is read back. Missing row → SAVE_FAILED.
- Banner shows ephemeral backend vs Neon counts. Full 100 stays locked. Engine scores stay separate.

## v2.4.6 — Fold6 install fix

- Re-signed APK (v2+v3). Public download on the live site so the phone does not save a GitHub login page as an APK.
- Wi-Fi feature is optional. Empty native-lib metadata removed.

## v2.4.5 — Galaxy Z Fold6 APK

- Android app wraps the live IDT site. When Wi-Fi or mobile data is on, quotes, filings, and analysis load from the network.
- Fold6: unlocked orientation, resizable activity, cover/inner screen, display cutout.
- Offline banner in the app; saved tickers remain readable without a connection.

## v2.4.4 — Searched tickers persist across reloads

- Browser keeps companies, snapshots, watchlist, and universes (not settings only).
- Boot merges the local cache with the server workspace so an empty/ephemeral deploy DB cannot wipe researched names.
- Same ticker with two ids keeps the id that already has analyses.

## v2.4.3 — Auth wall removed

- Sign-in is off. Google / X 버튼을 누르지 않아도 앱이 바로 열린다.
- `SignInGate` and `authMiddleware` removed from the product path. Workspace load/save and ticker research no longer require a session.
- `VITE_AUTH_ENABLED=false`. Full 100 stays locked (`EXECUTE_FULL_100` / `V24_OPERATOR_ENABLED` remain false).

## v2.4.2 — Production auth wall

- Deployed builds require a signed-in operator before hydrating the investment workspace.
- Better Auth schema is applied via `migrations/0001_auth.sql` (verbatim copy of `migrations/auth/0001_auth.sql`).
- `authMiddleware` protects persist/research server functions. Unsigned sessions cannot call `researchTicker` or load/save the workspace.
- Existing research tables stay unowned (single-operator workspace). No Full 100 rerun. `EXECUTE_FULL_100` and `V24_OPERATOR_ENABLED` remain false.

## v2.4.1 — Sticky identity column

- Ranking tables show **company name / ticker** stacked in two lines, narrow column.
- Horizontal scroll freezes that identity column so scores can slide underneath.

## v2.4 — Full 100 controlled execution

- Authorized one-time Full 100 research of the remaining 97 Sample100 names (`useAi=true`, chunk size 3).
- Existing INOD / 삼성전자 / KB금융 snapshots were excluded from the 97 jobs and not refreshed.
- Extra Smoke 12 names outside Sample100 (9 companies) were left untouched.
- All 97 jobs finished terminal `RESEARCH_REQUIRED` (honest Quality 70 gaps; not fabricated COMPLETE). FAILED = 0, CANCELLED = 0.
- Operator path (`V24_OPERATOR_ENABLED`) was used instead of leaving `EXECUTE_FULL_100` true in source. Flag is now **false**; Full 100 cannot auto-run again.
- Grok research: `reasoning_effort: "low"`, 90s timeout, max_tokens 6000 so grok-4.5 completes instead of aborting.
- Durable preview PGLite (`IDT_PGLITE_DIR`) + checkpoint restore only when that dir is set. Tests stay in-memory.
- Vite ignores `data/**` so WAL writes do not reload the app.
- Coverage: X-Bagger 89.6% · Oversold 100% · Quality 27.3% · median overall 73.5%. No score tuning after seeing ranks.
- `EXECUTE_FULL_100` remains `false`. Queue UI LOCKED.

## v2.3.2 — Preflight enforcement

- Production start (`startFull100FromWorkspace`) now **enforces** `preflight.ready` before inserting any `research_runs` / `research_jobs`.
- Authorization order: flag first → load workspace → real `probeQuoteProviders` → live preflight with `executeFull100: true` → create jobs only if ready.
- Failed preflight returns `PREFLIGHT_FAILED` + `failedChecks` (no secrets). Zero runs, zero jobs, zero research.
- Isolated tests: US/KR provider fail, DB down, queue missing, universe 99, US/KR split, fake demo, active-run conflict. Success path still creates **97** jobs.
- `EXECUTE_FULL_100` remains `false`. Full 100 not started.

## v2.3.1 — Execution wiring & CI repair

- Production start loads the DB workspace (`startFull100FromWorkspace`) before creating jobs. Empty-array start can no longer invent 100 remaining names.
- Real remaining with Sample100 + INOD / 삼성전자 / KB금융 = **97 jobs**, not 100.
- Production research path: `executeResearch` → `runSnapshotFromDraft` → `saveAnalysisTransaction` (job status in the same transaction). Grok X scores stay on the draft.
- Bounded chunk processor (`processFull100Chunk`, default 3). No detached unbounded `processRun`. Queue orchestrator exists but is gated by `EXECUTE_FULL_100 = NO`.
- `syncRunProgress`: `completed_jobs` = COMPLETE+PARTIAL+RESEARCH_REQUIRED; `failed_jobs` = FAILED; remaining 0 → run COMPLETE + `completed_at`.
- Pause / cancel / resume read `research_runs.status` from DB. Process restart recovers RESEARCHING → QUEUED.
- Preflight: no hardcoded `providerConfig = true` / `executorReady = true`. LIVE HTTP probe (Yahoo AAPL + Naver 005930). Queue LIVE CHECK shows UNKNOWN when live is missing — not PASS.
- GitHub CI portable: Grok-only brand/og tests skip when `.grok/skills` / `AGENTS.md` are absent. Gate-identity tests isolate `VITE_AUTH_ENABLED` so auth-off CI does not fail closed. `npm run test:grok-platform` kept for the builder.
- Full 100 still **not started**.

## v2.3 — Pre-Full100 hardening

- FinancialSnapshot: independent `cfo` / `fcf` (`fcfSource` provenance). Nasdaq OCF → CFO. Derived metrics never fall back across the two.
- Quality 70: CFO factors N/A without CFO; FCF factors N/A without FCF. Q41 still not a copy of ROIC.
- `saveAnalysisTransaction()` — company + analysis + evidence + optional job in one BEGIN/COMMIT; rollback on evidence/job failure.
- Persist status IDLE / SAVING / SAVED / SAVE_FAILED with retry. Critical writes are not swallowed.
- Durable `research_runs` / `research_jobs` (migration 0003). Recover RESEARCHING → QUEUED on boot. Does not auto-start.
- Batch runner: concurrency 3 (2–4), retry 429/timeout, pause/cancel, one snapshot per job. `EXECUTE_FULL_100 = false` → `FULL100_EXECUTION_DISABLED`.
- Preflight: LIVE vs LAST VERIFIED. No hardcoded live PASS.
- GitHub Actions CI: typecheck, lint, test, build on PGLite. No paid research.

## v2.2 — Post-P0 research validation

- RESEARCH REQUIRED explains coverage, missing X/Quality factors, NEXT RESEARCH, provider attempts
- Research Gaps tab ranks missing fields by score impact (not a buy signal)
- Coverage report: US vs KR by engine, adapter table, Full 100 pre-flight
- EXECUTE_FULL_100 = NO — queue is READY, batch not started; remaining universe listed
- KR annuals: Naver `finance/annual` (억원, consensus/current-year ignored) primary
- WiseReport IFRS연결 first annual block only (duplicate quarterly headers no longer null the parse)
- ROE is not used as ROIC; 연결/별도 and fiscal year recorded when present
- Failure classification + source attempt log (no secrets)
- Smoke 12 preserved; INOD untouched; fake demo remains 0
- Production build verified
- Smoke 12 runs the live research path: quote → filings/profile → evidence → three independent engines → DB insert
- KR financials from WiseReport (억원 annuals); 52-week range from Yahoo chart / Naver
- Identity overlay so empty KR sector still maps adapters (Financial / REIT / Biotech / Telecom / Cybersecurity)
- Quality: bank leverage/ROIC not forced; REIT ordinary P/E not forced; biotech inventory/ROIC conditional
- Evidence graph stamps tier / engines / factor targets / status / dates
- Refresh re-runs research and inserts a new immutable snapshot; history shows score/coverage/evidence diffs
- One engine failure no longer drops the other two
- Full 100 auto-analysis is **not** started
- Removed runtime Sample Six (Northline / Harbor / Redridge / 에코반도체장비 / 한강생활 / 서해모빌리티)
- Library 40 no longer auto-inserts heuristic scores
- Seeds IDT SAMPLE RESEARCH 100 as ticker / name / market / test_profile only (US 50 + KR 50, analyses = 0)
- `npm run cleanup:demo-data` targeted FAKE_DEMO delete (no truncate)
- Init regression: restart does not recreate fictional research

## v2.1 — P0 repair

- Database (Postgres / PGLite) is the operational source of truth
- `saveFromDraft` preserves Grok X-Bagger scores, evidence, catalysts
- Oversold N/A renormalization (no `?? 5`); OSM-v2.1
- Quality wrong proxies removed; MFC70-v1.2
- Evidence graph fields (tier / type / status / factor targets)
- Immutable analysis rows; Refresh inserts a new snapshot **without** discarding Grok scores
- Universe CSV / JSON / MD / XLSX import with rollback on error; XLSX export
- Dashboard / company CSV · JSON · XLSX export
- Self-contained P0 tests (no Grok-only fixtures)
- Docs: QUALITY 70 70-row audit, data model, migration, BUILD_STATE

## v2.0 — Investment Discovery Terminal

- Three independent engines: X-Bagger, Oversold, Quality 70
- Coverage / confidence / N/A renormalization
- 10 investor lenses as overlay
- Cross-strategy matrix and research priority
- Universe import / lock / version
- Immutable snapshots + override audit
