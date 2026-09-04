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
 Validated draft → transactional save → immutable analysis snapshot
        ↓
 Lenses (overlay) → Cross-strategy tags → Research Priority
```

Providers: market quote fetch, pack gather, optional xAI. Grok failure ≠ app failure. `saveFromDraft` preserves provider factor scores, evidence, and catalysts (does not re-run quote heuristics).
