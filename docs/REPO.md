# Repo map — IDT 투자발견 = Tenbagger Lite

Locked 2026-09-21.

## One product

| Role | Value |
|---|---|
| Product | IDT 투자발견 (Tenbagger Lite) |
| Code SoT | [JohnnyHan93/tenbagger-lite](https://github.com/JohnnyHan93/tenbagger-lite) |
| Production | https://idt.grok.me/ |
| Alternate host | https://tenbagger-lite.vercel.app — not primary; no Neon |
| Snapshot / alias | [JohnnyHan93/idt](https://github.com/JohnnyHan93/idt) — Grok export 2026-09-17, **do not commit engine work there** |

Tenbagger / Oversold / Quality 70 are engines inside this app. Scores are never summed.

## Why two GitHub slugs existed

- `tenbagger-lite` is the public working tree (Android, CI, XBG-v2.3 as of 2026-09-20).
- `idt` was created 2026-09-16 as a Grok workspace export, then got two docs commits pointing production at `idt.grok.me`.
- App code (`package.json`, `server/`, `migrations/`, most of `src/`) was the same snapshot. `idt` lagged after 2026-09-17. Unique files there: `docs/DEPLOY.md`, `docs/IDT_REFLECT.md`, Grok `AGENTS*` / artifacts.

Those two docs now live in this repo. New work goes only here.

## How to change the live site

GitHub push does **not** publish `idt.grok.me`. Publish from the Grok App Builder after merging here. See `docs/DEPLOY.md` and `docs/IDT_REFLECT.md`.
