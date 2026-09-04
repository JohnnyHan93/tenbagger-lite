# Build State — IDT 투자발견 v2.3.2

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

## v2.3.2 preflight enforcement

- Start is blocked unless live preflight `ready === true`
- Production path always probes US + KR quote endpoints (no xAI)
- Flag-off still returns `FULL100_EXECUTION_DISABLED` before load/probe
- LAST VERIFIED = GitHub Actions SUCCESS on `7ebab69` ([run 33847524248](https://github.com/JohnnyHan93/tenbagger-lite/actions/runs/33847524248))

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

LAST VERIFIED in the Queue UI is **GitHub Actions**. Source `github-actions`, SHA `7ebab6957328af5d616dccc6e3bee28993b4b608`, run [33847524248](https://github.com/JohnnyHan93/tenbagger-lite/actions/runs/33847524248) SUCCESS @ 2026-09-04T07:12:32.000Z. Do not point LAST VERIFIED at a SHA whose Actions run has not succeeded.

## Full 100

```text
FULL 100 EXECUTOR READY
PREFLIGHT ENFORCEMENT READY
EXECUTE_FULL_100 = NO
FULL 100 NOT STARTED
REMAINING = 97
GITHUB CI = GREEN
```
