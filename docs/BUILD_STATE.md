# Build State — IDT 투자발견 v2.4

## Stack

TanStack Start + React 19 + Tailwind v4 + Zustand (UI prefs only) + Kysely/pg + PGLite + Zod.

## Persistence

- Application DB: `migrations/0002_idt_domain.sql` + `migrations/0003_research_queue.sql`
- localStorage `idt-v21-prefs`: settings only
- Analyses are insert-only (immutable)
- Each ANALYZE/Refresh writes company + snapshot + evidence in **one transaction** (`saveAnalysisTransaction`)
- Persist status: IDLE / SAVING / SAVED / SAVE_FAILED (retry)
- Preview-only durable PGLite via `IDT_PGLITE_DIR` (not used in tests). Checkpoint restore is skipped unless that dir is set.

## Sample data (1A)

Runtime bootstrap no longer inserts fictional research.

| Class | What | Runtime |
|---|---|---|
| FAKE_DEMO | Sample Six + heuristic library scores | Removed |
| TEST_FIXTURE | `src/lib/samples.ts` + isolated ISO* identities in tests | Tests only |
| REAL_RESEARCH_DATA | IDT SAMPLE RESEARCH 100 identities + Smoke 12 + Full100 research | Seeded / analyzed |

Identity universe: 100 names, US 50 / KR 50. Sample100 analyses = 100 (3 preserved + 97 new). Extra Smoke 9 remain outside the universe. Scores are not identity-seeded.

## Model versions

| Model | Version | Status |
|---|---|---|
| X-Bagger Discovery | XBG-v2.0 | Locked |
| Oversold Opportunity | OSM-v2.1 | N/A renormalization; REIT skips ordinary P/E |
| Quality 70 | MFC70-v1.2 | Bank leverage/ROIC not forced; biotech inventory/ROIC conditional; CFO≠FCF |
| Investor Lenses | LENS-v1.0 | Overlay |

## v2.4 Full 100

- Run `run_4e0qh36xkgya` INITIAL_BATCH COMPLETE. 97 jobs, all `RESEARCH_REQUIRED`, FAILED 0.
- AI: grok-4.5 on all 97 jobs. Preserved three remain `filings+profile`.
- Operator locked: `V24_OPERATOR_ENABLED = false`. `EXECUTE_FULL_100 = false`.
- LAST VERIFIED = GitHub Actions SUCCESS on `e82507d` ([run 33854158716](https://github.com/JohnnyHan93/tenbagger-lite/actions/runs/33854158716))

## v2.3.2 preflight enforcement

- Start is blocked unless live preflight `ready === true`
- Production path always probes US + KR quote endpoints (no xAI)
- Flag-off still returns `FULL100_EXECUTION_DISABLED` before load/probe
- v2.3.2 LAST VERIFIED was `7ebab69` ([run 33847524248](https://github.com/JohnnyHan93/tenbagger-lite/actions/runs/33847524248)); superseded by v2.4 `e82507d`

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

LAST VERIFIED in the Queue UI is **GitHub Actions**. Source `github-actions`, SHA `e82507d03364ddc06ca21c220f31f031a7159ec3`, run [33854158716](https://github.com/JohnnyHan93/tenbagger-lite/actions/runs/33854158716) SUCCESS @ 2026-09-04T08:38:58.000Z. Do not point LAST VERIFIED at a SHA whose Actions run has not succeeded.

## Full 100

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
ANALYZED = 100
REMAINING = 0
FAKE DEMO = 0
```
