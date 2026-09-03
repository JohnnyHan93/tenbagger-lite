# IDT 투자발견

IDT 투자발견 — X-Bagger, Oversold, Quality 70. Tenbagger Lite와는 별도 앱입니다.

This system is a research and ranking tool. Scores are not automatic BUY/SELL signals.

## Three engines, never one composite

Shared research pack (price, filings, evidence, derived metrics) feeds three independent engines:

| Engine | Version | Question |
|---|---|---|
| X-Bagger / Wildcard | XBG-v2.0 | Can this market cap become 5–10x on a real path? |
| Oversold Opportunity | OSM-v1.0 | Cheap, or broken? |
| Quality 70 | MFC70-v1.1 | Is this a durable business on disclosure? |

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
| `DATABASE_URL` | server | Platform Postgres if enabled. Research snapshots persist in the browser. |

Never put secrets in `VITE_` vars.

## How to use

1. Discover → ticker → ANALYZE. Quote + filings pack → three engines.
2. Open the company page. X-Bagger, Oversold, Quality sit side by side.
3. N/A is not zero. Coverage and confidence are shown separately.
4. Override a factor: original snapshot stays, a new one is appended.
5. Universe Manager: paste CSV / JSON / markdown, dry-run, import, lock.
6. Export matrix CSV or a company research JSON.

Manual mode: if quote lookup fails, enter numbers yourself via Discover error path / later re-run.

## Persistence

Browser local storage (`idt-v2`). Export Backup JSON from Settings. Historical snapshots are immutable.

## Models

- XBG-v2.0 locked
- OSM-v1.0 locked — `Opp = 0.40F + 0.25V + 0.10O + 0.25R`, Value Trap separate
- MFC70-v1.1 canonical. MFC74-v3.0 listed as experimental, never mixed into 70.
- LENS-v1.0 overlay. Not added to Quality.

## Testing

```bash
npm test
npm run typecheck
npm run build
```

## Locked 59

Not part of this build. Import that file later through Universe Manager (version → lock → batch later).

## Limitations

Public Yahoo / Nasdaq / Naver pages. AR, inventory, audit opinion, backlog often N/A. That lowers coverage; it does not invent a zero.
