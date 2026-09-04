# Data model

PostgreSQL-compatible tables in `migrations/0002_idt_domain.sql`:

| Table | Role |
|---|---|
| companies | identity + payload |
| analyses | insert-only snapshots (jsonb payload, model_versions) |
| evidences | evidence graph rows linked to analysis |
| universes / universe_members | versioned lists, lock status |
| analysis_change_logs | override / factor diffs |
| watchlist | company ids |
| app_kv | settings |

`Snapshot` is the unit of analysis. Fields: asOf, price, financials, derived, evidence, xbagger, oversold, quality, lenses, tags, coverage, confidence, researchProvider.

Refresh appends a new snapshot from the previous draft (evidence and X-Bagger scores preserved). Override appends a new snapshot and an audit log row.

Universe: name, version, market, status open|locked|archived, tickers[]. Locked 59 is not hardcoded.
