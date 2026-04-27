# Schema snapshots (GrowthPlatform)

Purpose: keep a **versioned SQL snapshot** of the `GrowthPlatform` schema (or the canonical baseline copy) to compare before/after Supabase deploy.

> O arquivo `baseline-fallback-*.sql` foi removido do repo: a fonte canônica de schema é `supabase/migrations/20260426010000_baseline_canonical.sql`. Use os comandos abaixo para gerar um snapshot novo quando precisar.

## Commands

From project root:

```bash
node scripts/snapshot-gp-schema.js --file-only
```

Copies `supabase/migrations/20260426010000_baseline_canonical.sql` into this folder with a date stamp.

When the Supabase project is **linked** and CLI works:

```bash
npx supabase db dump --linked --schema GrowthPlatform -f snapshots/GrowthPlatform-schema-YYYYMMDD.sql
```

Or run without `--file-only` (requires link + auth):

```bash
node scripts/snapshot-gp-schema.js
```

## What to diff after go-live

- Table set and columns on `calls`, `call_analysis`, `knowledge_*`
- RPC `match_knowledge_chunks` and vector dimension (1536)
- Views `unified_calls`, `urgent_calls`
