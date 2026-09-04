# Build State — IDT 투자발견 v2.2

## Stack

TanStack Start + React 19 + Tailwind v4 + Zustand (UI prefs only) + Kysely/pg + PGLite + Zod.

## Persistence

- Application DB: `migrations/0002_idt_domain.sql`
- localStorage `idt-v21-prefs`: settings only
- Analyses are insert-only (immutable)
- Each ANALYZE/Refresh writes company + snapshot immediately (`saveCompanyFn` / `insertAnalysisFn`)

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

## Latest verification

```text
Production Build: PASS (npm run build)

Typecheck:
npx tsc --noEmit
PASS

Tests:
npm test
src: 124 passed / 0 failed
scripts: 195 passed / 0 failed
total: 319 passed / 0 failed

Lint (changed pipeline files):
PASS

Smoke 12:
12/12 preserved (not auto-refreshed)
12/12 retained after localStorage clear + reload (P0)
Fake demo names remain absent
Full 100: READY, not started
EXECUTE_FULL_100 = NO
```
