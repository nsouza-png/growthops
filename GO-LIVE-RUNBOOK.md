# Go-live operational runbook (short)

Use together with `ROLLBACK-CHECKLIST.md` and `SYSTEM-LLM-HANDOFF.md`.

## 1) Identify a stuck pipeline by `call_id`

Query the call row (dashboard or SQL):

- `processing_status` stuck in `fetching_transcript`
- `rag_index_status` stuck in `indexing`
- `rag_enrich_status` stuck in `enriching`

Compare `updated_at`, `rag_index_started_at`, `rag_enrich_started_at` with current time.

Local helper (requires service role):

```bash
set SUPABASE_URL=...
set SUPABASE_SERVICE_ROLE_KEY=...
set STUCK_MINUTES=15
node scripts/pipeline-health-stuck.js
```

Exit code `2` means at least one candidate row was found (review list).

## 2) Safe unlock (when to use)

Unlock only after you confirm there is **no active Edge Function** still running for that call (check Supabase function logs for the same `call_id` within the last minutes).

### Stuck transcript fetch

If the call is not progressing and `processing_status = 'fetching_transcript'` for too long:

1. Check Edge logs for `fetch-transcript` (tl;dv errors, timeouts).
2. If the run died without clearing status, set back to a state that allows retry, for example:

- `processing_status`: `pending` or `transcript_failed` (choose one consistent with your ops convention)
- Do **not** set `transcript_fetched = true` unless the transcript is actually stored.

Then re-invoke `fetch-transcript` once.

### Stuck RAG index

If `rag_index_status = 'indexing'` and `rag_index_started_at` is old:

1. Check logs for `rag-index-transcript` (OpenAI, insert errors).
2. Set `rag_index_status` to `failed` or `idle` (your convention), then re-run `rag-index-transcript` once.

### Stuck RAG enrich

If `rag_enrich_status = 'enriching'` and `rag_enrich_started_at` is old:

1. Check logs for `rag-enrich-call`.
2. Set `rag_enrich_status` to `failed` or `idle`, then invoke `rag-enrich-call` again.

## 3) Reprocess vs discard

**Reprocess** when:

- Transcript data is valid but analysis/RAG failed transiently (API rate limit, timeout).
- You fixed configuration (keys, model, RPC) and need a single call refreshed.

**Discard / isolate** when:

- Wrong meeting linked, duplicate `tldv_call_id`, or corrupt transcript.
- Mark call `status` inactive (if your schema supports it) or stop webhooks for that meeting; do not loop automatic retries.

For RAG-only bad rows: delete `knowledge_files` / `knowledge_chunks` for `source = call:<call_id>:transcript` before re-indexing (see `ROLLBACK-CHECKLIST.md`).

## 4) Release gate (automated)

```bash
npm run preflight:release
```

Requires `E2E_TEST_*`, `SUPABASE_*`, `E2E_RAG_CALL_ID`, and a call with `calls.transcript_text` populated for runtime RAG validation.

## 5) RAG cost controls (environment)

See `SYSTEM-LLM-HANDOFF.md` (section RAG / cost). Summary:

| Environment | Suggested `RAG_MATCH_TOP_K_CAP` | Notes |
|-------------|-------------------------------|--------|
| dev         | 12                            | Higher recall for debugging |
| staging     | 10                            | Middle ground |
| production  | 8                             | Default cost/latency balance |

Optional: `RAG_MATCH_TOP_K_DEFAULT` for clients that omit `topK` (default 8 in code).

## 6) Troubleshooting (common local / linked-project failures)

### `Remote migration versions not found in local migrations directory`

The linked Supabase project’s migration history does not match this repo. Do **not** blindly `db push` until reconciled. Typical fix: `supabase db pull` (or team alignment + `supabase migration repair` only when you understand remote vs local versions).

### `relation "GrowthPlatform.*" does not exist`

Migrations were not applied to that database (or you linked the wrong project). After migration history is aligned, apply migrations so `calls`, `user_roles`, etc. exist, then re-run `pipeline:health` and `audit:roles`.

### `snapshot:schema:linked` / Docker pipe errors on Windows

Supabase CLI `db dump` often needs **Docker Desktop** running. If Docker is unavailable, use `npm run snapshot:schema` for baseline-only snapshot, or export schema another way after go-live.

### Playwright: `Project "chromium" not found`

Playwright config lives under **`app/`**. From repo root use `npm run e2e:authenticated`, or `cd app` then `npx playwright test --project=chromium …`, or `npx playwright test -c app/playwright.config.ts …`.

### Playwright: stuck on `/#/login` after submit

The Vite app needs **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_ANON_KEY`** at dev-server startup. `app/playwright.config.ts` loads `app/.env.local` (and friends) and passes those into `webServer.env`. Ensure `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` match a real Auth user in that project.

### `preflight:release` — `E2E_RAG_CALL_ID must be a valid UUID`

Set `E2E_RAG_CALL_ID` to a real `calls.id` UUID that has `transcript_text` populated (for RAG UI / runtime checks).

### Secrets in terminal history

If URLs or keys were pasted into a shell or chat, **rotate** anon and service-role keys in the Supabase dashboard after stabilization.
