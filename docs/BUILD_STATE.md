# Build State — IDT 투자발견 v2.3.1

## Stack

TanStack Start + React 19 + Tailwind v4 + Zustand (UI prefs only) + Kysely/pg + PGLite + Zod.

## Persistence

- Application DB: `migrations/0002_idt_domain.sql` + `migrations/0003_research_queue.sql`
- localStorage `idt-v21-prefs`: settings only
- Analyses are insert-only (immutable)
- Each ANALYZE/Refresh writes company + snapshot + evidence in **one transaction** (`saveAnalysisTransaction`)
- Persist status: IDLE / SAVING / SAVED / SAVE_FAILED (retry)

## Sample data (1A)

Runtime bootstrap no longer inserts fictional research.

| Class | What | Runtime |
|---|---|---|
| FAKE_DEMO | Sample Six + heuristic library scores | Removed |
| TEST_FIXTURE | `src/lib/samples.ts` + isolated ISO* identities in tests | Tests only |
| REAL_RESEARCH_DATA | IDT SAMPLE RESEARCH 100 identities + Smoke 12 research | Seeded / analyzed |

Identity universe: 100 names, US 50 / KR 50. Smoke 12 have live research snapshots. Scores are not identity-seeded.

## Model versions

| Model | Version | Status |
|---|---|---|
| X-Bagger Discovery | XBG-v2.0 | Locked |
| Oversold Opportunity | OSM-v2.1 | N/A renormalization; REIT skips ordinary P/E |
| Quality 70 | MFC70-v1.2 | Bank leverage/ROIC not forced; biotech inventory/ROIC conditional; CFO≠FCF |
| Investor Lenses | LENS-v1.0 | Overlay |

## v2.3.1 execution wiring

- Start action loads DB workspace, then creates remaining jobs only
- Production deps: `executeResearch` + `runSnapshotFromDraft` + `saveAnalysisTransaction`
- Chunk size 3; client orchestrator gated off
- Run counters synced from actual job rows
- LIVE vs LAST VERIFIED vs Vercel deploy are three different claims

## Verification layers (not interchangeable)

| Layer | What it proves | Where |
|---|---|---|
| Local / Grok Builder | typecheck, lint, `npm test`, `npm run build` in this workspace | this session |
| GitHub Actions | same commands on a fresh checkout without `.grok/skills` | `.github/workflows/ci.yml` |
| Vercel deployment | hosted preview/prod of a pushed SHA | Vercel dashboard |

LAST VERIFIED in the Queue UI is **GitHub Actions** once that run is green. Current LAST VERIFIED: `20673fd` source=`github-actions` @ 2026-09-04T06:43:27.000Z ([run 33845002445](https://github.com/JohnnyHan93/tenbagger-lite/actions/runs/33845002445)). v2.3 SHA `65e3019` is not GitHub-green.

## Full 100

```text
FULL 100 EXECUTOR ACTUALLY READY
EXECUTE_FULL_100 = NO
FULL 100 NOT STARTED
```

Executor ready ≠ authorized. Do not add a Start button while the flag is NO.

## Sample data (1A)

Runtime bootstrap no longer inserts fictional research.

| Class | What | Runtime |
|---|---|---|
| FAKE_DEMO | Sample Six + heuristic library scores | Removed |
| TEST_FIXTURE | `src/lib/samples.ts` | Tests only |
| REAL_RESEARCH_DATA | IDT SAMPLE RESEARCH 100 identities + Smoke 12 research | Seeded / analyzed |

Identity universe: 100 names, US 50 / KR 50. Smoke 12 have live research snapshots. Scores are not identity-seeded.

## Model versions

| Model | Version | Status |
|---|---|---|
| X-Bagger Discovery | XBG-v2.0 | Locked |
| Oversold Opportunity | OSM-v2.1 | N/A renormalization; REIT skips ordinary P/E |
| Quality 70 | MFC70-v1.2 | Bank leverage/ROIC not forced; biotech inventory/ROIC conditional |
| Investor Lenses | LENS-v1.0 | Overlay |

## v2.2 research

- Naver annual JSON primary for KR 억원 actuals (`isConsensus=Y` and current calendar year ignored)
- WiseReport first IFRS연결 annual block for assets / CAPEX / CFO / debt / shares / statement basis
- Research gaps ranked by engine impact; Coverage report split US vs KR and by adapter
- Full 100: READY, `EXECUTE_FULL_100 = NO`

## Latest local verification (Grok Builder)

```text
Production Build: PASS (npm run build)

Typecheck:
npx tsc --noEmit
PASS

Tests:
npm test
src: 163 passed / 0 failed
scripts: 195 passed / 0 failed
total: 358 passed / 0 failed

Lint:
PASS (0 errors)

Smoke 12:
12/12 preserved (not auto-refreshed)
INOD preserved
Fake demo names remain absent
Full 100: executor wired, not started
EXECUTE_FULL_100 = NO
```
