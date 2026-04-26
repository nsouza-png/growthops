# Release Evidence

Date: 2026-04-26

## 1) preflight:release

- Command: `npm run preflight:release`
- Result: `FAIL` (gate correctly blocked due missing required envs)
- Missing envs reported:
  - `E2E_TEST_EMAIL`
  - `E2E_TEST_PASSWORD`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `E2E_RAG_CALL_ID`

## 2) RAG runtime validated call_id

- Command available: `npm run rag:runtime-check -- <call_id>`
- Current run status: `NOT EXECUTED` (blocked by missing release envs above)
- Target env var for gate: `E2E_RAG_CALL_ID`

## 3) Schema snapshot version

- Command: `npm run snapshot:schema:linked`
- Result: `FAIL` (`Cannot find project ref. Have you run supabase link?`)
- Fallback artifact generated:
  - `snapshots/baseline-fallback-20260426.sql`

## 4) Idempotency test evidence (enrich-call lock)

- Command: `npm run test:enrich-lock`
- Result: `SKIPPED` (requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `E2E_LOCK_TEST_CALL_ID` or `E2E_RAG_CALL_ID`)

## 5) Structured logs sanity check (production)

- Status: `PARTIALLY VERIFIED`
- Verified in code:
  - `tldv-webhook`
  - `enrich-call`
  - `fetch-transcript`
  - `analyze-call`
  - `rag-index-transcript`
  - `rag-enrich-call`
- CLI limitation in current environment:
  - `npx supabase logs --help` => unknown command `logs`
  - Production log sanity must be checked in Supabase dashboard logs for emitted fields:
    - `call_id`
    - `step`
    - `status`
    - `duration_ms`

