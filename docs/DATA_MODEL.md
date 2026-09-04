# Data model

PostgreSQL-compatible tables in `migrations/0002_idt_domain.sql` and `migrations/0003_research_queue.sql`:

| Table | Role |
|---|---|
| companies | identity + payload |
| analyses | insert-only snapshots (jsonb payload, model_versions) |
| evidences | evidence graph rows linked to analysis |
| universes / universe_members | versioned lists, lock status |
| analysis_change_logs | override / factor diffs |
| watchlist | company ids |
| app_kv | settings |
| research_runs | Full 100 / refresh / manual run header (status, totals, model versions) |
| research_jobs | durable per-ticker job (status, attempts, failure class, provider log) |

One logical analysis save is a **transaction**: company + analysis + evidence (+ optional job update). Partial evidence rows are rolled back.

`FinancialSnapshot` stores `cfo` and `fcf` as separate fields (`fcfSource`: REPORTED | CFO_MINUS_CAPEX). They are never used as fallbacks for each other.

`Snapshot` is the unit of analysis. Fields: asOf, price, financials, derived, evidence, xbagger, oversold, quality, lenses, tags, coverage, confidence, researchProvider.

Refresh appends a new snapshot from the previous draft (evidence and X-Bagger scores preserved). Override appends a new snapshot and an audit log row. Infrastructure retries inside one research job do not create extra snapshots.

Universe: name, version, market, status open|locked|archived, tickers[]. Locked 59 is not hardcoded.

Job status: NOT_RESEARCHED, QUEUED, RESEARCHING, COMPLETE, PARTIAL, RESEARCH_REQUIRED, FAILED, RETRY_WAIT, CANCELLED. PARTIAL / RESEARCH_REQUIRED are successful executions, not FAILED.
