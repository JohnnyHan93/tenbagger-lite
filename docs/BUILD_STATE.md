# Build State — Investment Discovery Terminal v2

## Stack

TanStack Start + React 19 + Tailwind v4 + Zustand persist + Zod.
Deterministic engines. Optional xAI overlay (user-initiated).

## Completed modules

- Shared company / evidence / derived-metric core
- X-Bagger 10-factor engine (XBG-v2.0) with coverage, gates, 10x math
- Oversold Opportunity engine (OSM-v1.0) exact formula + Value Trap + Case
- Quality 70 Factor engine (MFC70-v1.1) N/A renormalization + diagnostics
- 10 Investor Lenses (LENS-v1.0) overlay, not added to Quality score
- Cross-strategy matrix + research priority
- Universe manager: import / version / lock
- History snapshots, manual override, research queue
- Import/export CSV JSON
- Sample fixtures (6, labeled SAMPLE)

## Model versions

| Model | Version | Status |
|---|---|---|
| X-Bagger Discovery | XBG-v2.0 | Locked |
| Oversold Opportunity | OSM-v1.0 | Locked |
| Quality 70 | MFC70-v1.1 | Locked canonical |
| Quality 74 | MFC74-v3.0 | Experimental, not mixed |
| Investor Lenses | LENS-v1.0 | Overlay |

## Latest verification

- typecheck: pass
- engine unit tests: 8/8 pass (Opp=6.80, 70 factors, N/A≠0, universe parse, VT separate, coverage, 10x gate)
- production build: pass
- browser smoke (dev + built): pass, no console errors

## Known limitations

- Live quote coverage is limited to Yahoo/Nasdaq/Naver public pages. AR, inventory, backlog, audit opinion often N/A.
- No broker, no alerts cron, no Locked 59 universe.
- Persistence is local to the browser (personal terminal). Export for backup.

## Next

Peer/history normalization and 74-factor alternate scoring when extra filings exist.
