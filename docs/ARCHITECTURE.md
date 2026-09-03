# Architecture

TanStack Start app. Client store holds companies, immutable snapshots, universes.

```
Quote + Filings pack
        ↓
  Derived metrics + Evidence
        ↓
┌────────────┬────────────┬────────────┐
│ X-Bagger   │ Oversold   │ Quality 70 │
└────────────┴────────────┴────────────┘
        ↓
 Lenses (overlay) → Cross-strategy tags → Research Priority
```

Providers: market quote fetch, pack gather, optional xAI. Grok failure ≠ app failure.
