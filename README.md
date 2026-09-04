# IDT 투자발견

IDT 투자발견 — X-Bagger, Oversold, Quality 70. Tenbagger Lite와는 별도 앱입니다.

This system is a research and ranking tool. Scores are not automatic BUY/SELL signals.

## Three engines, never one composite

Shared research pack (price, filings, evidence, derived metrics) feeds three independent engines:

| Engine | Version | Question |
|---|---|---|
| X-Bagger / Wildcard | XBG-v2.0 | Can this market cap become 5–10x on a real path? |
| Oversold Opportunity | OSM-v2.1 | Cheap, or broken? |
| Quality 70 | MFC70-v1.2 | Is this a durable business on disclosure? |

Research Priority is optional and is **not** an investment grade.

## Setup

```bash
npm install
npm run dev
```

Listens on port 8080 in this environment.

## Environment

| Variable | Where | Purpose |
|---|---|---|
| `XAI_API_KEY` | server | Optional Grok overlay. App works without it. |
| `DATABASE_URL` | server | Neon Postgres in production. Preview uses PGLite. Companies, analyses, evidence, universes persist here. |

Never put secrets in `VITE_` vars.

## How to use

1. Discover → ticker → ANALYZE. Quote + filings pack → three engines. Results save to the DB immediately (not localStorage).
2. Open the company page. X-Bagger, Oversold, Quality sit side by side. Refresh inserts a new snapshot; history is immutable.
3. IDT SAMPLE RESEARCH 100 is identity-only (50 US / 50 KR). Smoke 12 is the first live research batch. Full 100 executor is implemented and **locked** (`EXECUTE_FULL_100 = NO`).
2. Open the company page. X-Bagger, Oversold, Quality sit side by side.
3. N/A is not zero. Coverage and confidence are shown separately.
4. Override a factor: original snapshot stays, a new one is appended.
5. Universe Manager: CSV / JSON / MD / XLSX, dry-run, import, lock, export.
6. Dashboard and company pages export CSV / JSON / XLSX.

The default universe is **IDT SAMPLE RESEARCH 100** (50 US + 50 KR identities only). It does **not** seed prices, financials, evidence, or scores. Analyze from Discover.

Manual mode: if quote lookup fails, enter numbers yourself via Discover error path / later re-run.

## Persistence

Application database is the operational source of truth (`migrations/0002_idt_domain.sql`). Preview uses PGLite; production uses Neon when `DATABASE_URL` is set.

Browser localStorage key `idt-v21-prefs` stores **UI settings only**. Companies, snapshots, evidence, universes, and history live in the database.

Analyses are insert-only. Refresh and factor override append a new snapshot.

## Models

- XBG-v2.0 locked
- OSM-v2.1 — `Opp = 0.40F + 0.25V + 0.10O + 0.25R`, N/A renormalized (not 5, not 0). Value Trap separate
- MFC70-v1.2 canonical. MFC74-v3.0 listed as experimental, never mixed into 70.
- LENS-v1.0 overlay. Not added to Quality.

## Testing

```bash
npm test
npm run typecheck
npm run build
npm run cleanup:demo-data
```

## Locked 59

Not part of this build. Import that file later through Universe Manager (version → lock → batch later).

## Limitations

Public Yahoo / Nasdaq / Naver pages. AR, inventory, audit opinion, backlog often N/A. That lowers coverage; it does not invent a zero.
