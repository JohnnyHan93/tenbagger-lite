# IDT 투자발견 (Tenbagger Lite)

하나의 프로젝트다.

| Role | Value |
|---|---|
| Product | IDT 투자발견 |
| Code | [JohnnyHan93/tenbagger-lite](https://github.com/JohnnyHan93/tenbagger-lite) |
| Live | **https://idt.grok.me/** |
| Alias repo | [JohnnyHan93/idt](https://github.com/JohnnyHan93/idt) — frozen 2026-09-17 export, not the working tree |

Map: [`docs/REPO.md`](docs/REPO.md). Deploy: [`docs/DEPLOY.md`](docs/DEPLOY.md). Johnny AI OS path: [`docs/IDT_REFLECT.md`](docs/IDT_REFLECT.md).

예전에 따로 있던 Tenbagger / Oversold / Quality 70은 도구가 아니라 이 앱 안의 세 엔진이다. 점수는 합산하지 않는다.

This system is a research and ranking tool. Scores are not automatic BUY/SELL signals.

(Alternate host https://tenbagger-lite.vercel.app is not primary.)

## Three engines, never one composite

Shared research pack (price, filings, evidence, derived metrics) feeds three independent engines:

| Engine | Version | Question |
|---|---|---|
| X-Bagger / Wildcard | XBG-v2.3 | Can this market cap become 5–10x on a real path? |
| Oversold Opportunity | OSM-v2.3 | Cheap, or broken? |
| Quality 70 | MFC70-v1.4 | Is this a durable business on disclosure? |

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
3. IDT SAMPLE RESEARCH 100 is identity + live batch. Smoke 12 ran first. Full 100 is **authorized** (`EXECUTE_FULL_100 = YES`) and writes only on Neon. Existing snapshots are skipped.
4. N/A is not zero. Coverage and confidence are shown separately.
5. Override a factor: original snapshot stays, a new one is appended.
6. Universe Manager: CSV / JSON / MD / XLSX, dry-run, import, lock, export.
7. Dashboard and company pages export CSV / JSON / XLSX.

The default universe is **IDT SAMPLE RESEARCH 100** (50 US + 50 KR identities only). It does **not** seed prices, financials, evidence, or scores. Analyze from Discover.

Manual mode: if quote lookup fails, enter numbers yourself via Discover error path / later re-run.

## Persistence

Application database is the operational source of truth (`migrations/0002_idt_domain.sql`). Preview uses PGLite; production uses Neon when `DATABASE_URL` is set.

Browser localStorage key `idt-v21-prefs` stores **UI settings only**. Companies, snapshots, evidence, universes, and history live in the database.

Analyses are insert-only. Refresh and factor override append a new snapshot.

Production note (2026-09-14): the live site can show Sample100 identities with **0 analyses**. That is identity seed, not the v2.4 Full 100 research set (that run lived on preview PGLite).

## Models

- XBG-v2.3 — F10 needs observed growth + assumedCAGR; no synthetic 0% CAGR / fixed EV/S pack; TAM/share/customers need numbers or names
- OSM-v2.3 — `Opp = 0.40F + 0.25V + 0.10O + 0.25R`, N/A renormalized. 3Y CAGR/FCF and peak-NI hits. Value Trap 0–10 separate. TURNAROUND needs complete Case
- MFC70-v1.4 canonical (series-backed Q04/Q22/Q35/Q38/Q40/Q42/Q45). MFC74-v3.0 listed as experimental, never mixed into 70.
- LENS-v1.0 overlay. Not added to Quality.
- CRITERIA-v1 runtime pack on snapshots.

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
