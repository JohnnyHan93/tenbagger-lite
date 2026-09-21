# Project: IDT 투자발견 (Tenbagger Lite)

Same project. Product name IDT 투자발견. Research home is INV-RESEARCH.

- Code SoT: `JohnnyHan93/tenbagger-lite`
- Alias / frozen Grok export: `JohnnyHan93/idt` (do not develop there)
- Production: **https://idt.grok.me/** — see `docs/DEPLOY.md` and `docs/IDT_REFLECT.md`
- Repo map: `docs/REPO.md`

Tenbagger / Oversold / Quality 70 are engines inside this app, not separate products.

Non-negotiable rules:

- Greenfield product on the sandbox TanStack Start stack. Do not switch to Next.js/Prisma.
- X-Bagger, Oversold, and Quality scores remain separate. Never sum them into one investment score.
- Shared Evidence / Metric Core is used by all engines.
- Never fabricate missing market or financial data.
- N/A is not zero. Missing data reduces coverage, not the company score.
- Material scores require traceable evidence.
- Historical analyses are immutable snapshots. Refresh appends; it does not overwrite.
- Model changes require version bumps.
- Secrets remain server-side. No `VITE_` for API keys.
- Locked 59 is NOT part of the initial build.
- Application must remain Vercel-deployable on the existing TanStack Start pipeline.
- Tests and production build must pass before completion.
- Research Priority is not a buy signal.
- Sample fixtures must be labeled SAMPLE and never presented as live analysis.
- Johnny AI OS investment-room engine changes escalate as IDT_REFLECT (`docs/IDT_REFLECT.md`); no silent sheet-only drift; no auto sheet sync.
- New commits go to `tenbagger-lite` only.
