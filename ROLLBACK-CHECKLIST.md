# Rollback Checklist (Short)

## 1) Disable a specific edge function quickly

- In Supabase dashboard, disable or remove invocation trigger path from caller function.
- For async chained calls, comment/guard the `fetch(.../functions/v1/<target>)` block.
- Redeploy only the caller function.

## 2) Roll back a recent migration

- Preferred: create a forward-fix migration that restores previous schema behavior.
- Emergency fallback: apply inverse SQL manually in controlled window.
- Always validate:
  - `calls`
  - `call_analysis`
  - `framework_scores`
  - `knowledge_files`, `knowledge_chunks`

## 3) Isolate one problematic call

- Use `call_id` as isolation key.
- Set status flags to stop automatic reprocessing for that call.
- Purge call-scoped RAG vectors by source:
  - `source = call:<call_id>:transcript`
- Re-run pipeline manually for only that `call_id`.

## 4) Validation after rollback

- Frontend:
  - `npx tsc --noEmit`
  - `npx vitest run`
  - `npx playwright test --project=chromium`
- Data:
  - check `unified_calls` and `call_analysis` consistency for affected calls
- RAG:
  - run dry-run ingest guardrails locally before re-enabling automatic indexing
