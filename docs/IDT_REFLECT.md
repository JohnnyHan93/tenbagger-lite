# IDT_REFLECT — Johnny AI OS 투자실 → IDT app

Locked 2026-09-17 (비서실장 / 주니킹). Repo pointer updated 2026-09-21.

## Purpose
When the investment room (투자실) finds engine / scoring / evidence / universe improvements, escalate as **IDT_REFLECT** to Chief of Staff. Do **not** silently drift sheet-only rules away from this app.

## Production
- App: IDT 투자발견 (Tenbagger Lite)
- Code repo: `JohnnyHan93/tenbagger-lite`
- Alias: `JohnnyHan93/idt` (export snapshot only)
- Production URL: **https://idt.grok.me/** (canonical; ignore stale vercel.app URLs in older notes)

## Packet shape
- engine: X-Bagger | Oversold | Quality70 | Evidence/Metric Core | Universe/coverage
- problem
- proposal
- evidence
- version_bump?: yes/no
- human_gate?: weights / live deploy / model major

## Flow
1. 투자실 proposes IDT_REFLECT
2. 비서실장 scopes
3. PR on **tenbagger-lite**
4. Human merge + Grok App Builder publish to idt.grok.me
5. Optional sheet/monitor sync

## Never
- Auto-sync Google Sheets ↔ this repo
- Sum X-Bagger + Oversold + Quality into one score
- Change Oversold weights F40/V25/O10/R25 without Human GO
- Live buys / invent numbers / treat N/A as 0
- Commit product code to `JohnnyHan93/idt`

## Applied 2026-09-21 — OSM-MON + XBG-SCR + MFC70-v1.5

Packet: Johnny-AI-OS ADR-0004 / MONITORING_SPEC / NEWS_MONITORING_RULES.

- Oversold overlay: MEG, price path, drawdown alert, sector checklist, capital-return overlay. Opp weights **not** changed.
- X-Bagger screening overlay XBG-SCR-v1.0 (runway / dilution / PoC / backlog). XBG-v2.3 formula **not** changed (OS news log: 수식 보류).
- Quality Q57 cash runway → MFC70-v1.5. 70 factors. 74 not mixed.
