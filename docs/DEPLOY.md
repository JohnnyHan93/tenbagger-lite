# Deploy — IDT 투자발견

## Canonical

- Product: IDT 투자발견 (Tenbagger Lite)
- Code: `JohnnyHan93/tenbagger-lite`
- URL: **https://idt.grok.me/**
- Alias repo `JohnnyHan93/idt` is a frozen Grok export. Do not deploy from it.
- `https://tenbagger-lite.vercel.app` is historical. Do not treat it as primary. It is not the connected-hobby Vercel path for this product.

## Pipeline

1. Merge to `main` on `JohnnyHan93/tenbagger-lite`.
2. Publish through the host that serves **idt.grok.me** (Grok App Builder / platform deploy).
3. Confirm https://idt.grok.me/ loads after release.

GitHub-only push does not update the live app.

## Human gates

- Domain / DNS / host binding: Human on the real deploy host. Do not invent secrets or DNS records in chat.
- Env: `DATABASE_URL` (Neon), optional `XAI_API_KEY` — server-side only. Never `VITE_` for secrets.
- Model weight / Oversold F40·V25·O10·R25 / live buy path: Human GO per `docs/IDT_REFLECT.md`.

## Verify after deploy

- Open https://idt.grok.me/ and confirm the app loads.
- Prefer Neon-backed production (not ephemeral PGLite) for durable analyses.
