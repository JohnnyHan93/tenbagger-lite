# Architecture

TanStack Start app. Database (Neon in production, PGLite in preview) is the operational source of truth. Zustand holds the session workspace and UI prefs (`idt-v21-prefs` settings only).

```
Ticker → Identity → Quote + Filings pack
        ↓
  Evidence graph → Derived metrics
        ↓
┌────────────┬────────────┬────────────┐
│ X-Bagger   │ Oversold   │ Quality 70 │
│ XBG-v2.0   │ OSM-v2.1   │ MFC70-v1.2 │
└────────────┴────────────┴────────────┘
        ↓
 Validated draft → transactional save (company + analysis + evidence + job) → immutable analysis snapshot
        ↓
 Lenses (overlay) → Cross-strategy tags → Research Priority
```

Providers: market quote fetch, pack gather, optional xAI. Grok failure ≠ app failure. `saveFromDraft` preserves provider factor scores, evidence, and catalysts (does not re-run quote heuristics).

Full 100 batch runner (`src/lib/research/runner.ts`) is durable (`research_runs` / `research_jobs`), concurrency 2–4 (default 3), retry on 429/timeout, resume RESEARCHING→QUEUED. Gated by `EXECUTE_FULL_100`. Preflight splits LIVE checks from LAST VERIFIED build metadata. Save failures surface as SAVE_FAILED with retry; they are not swallowed.
