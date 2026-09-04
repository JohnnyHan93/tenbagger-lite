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
