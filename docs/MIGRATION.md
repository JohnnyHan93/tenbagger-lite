# Migration

Domain schema: `migrations/0002_idt_domain.sql` (applied by `npm run db:migrate` and on PGLite first query).

Fresh path:

```
empty database → migrate → boot → create company → analyze → save → restart → same analysis
```

Legacy browser key `idt-v2` is imported **once** if the database is empty (`HydrateGate`), then persisted to the database. Ongoing UI prefs use `idt-v21-prefs` (settings only).

Previous `tenbagger-lite-v3` local data is not auto-imported. Export JSON from the old app if you still have it.

Universe import accepts CSV / JSON / markdown ticker tables / XLSX. Errors abort the commit (no partial universe).
