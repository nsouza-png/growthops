# Deploy Checklist (Final)

## Pre-deploy

- [ ] `npm run preflight:go-live` = PASS
- [ ] `npm run preflight:release` = PASS
- [ ] `npm run snapshot:schema:linked` generated fresh schema snapshot
- [ ] `RELEASE-EVIDENCE.md` updated with timestamp + latest PASS results
- [ ] Confirm release env vars are set (`E2E_TEST_*`, `SUPABASE_*`, `E2E_RAG_CALL_ID`)
- [ ] Confirm no stuck pipeline rows (`npm run pipeline:health`)
- [ ] Confirm rollback plan ready (`ROLLBACK-CHECKLIST.md`, `GO-LIVE-RUNBOOK.md`)

## Deploy

- [ ] Apply pending migrations in target project
- [ ] Deploy/update required Edge Functions
- [ ] Verify function env vars in Supabase dashboard
- [ ] Trigger one controlled real call flow for smoke validation

## Post-deploy validation

- [ ] Check call pipeline end-to-end for one real `call_id`
- [ ] Validate DB columns: `rag_enriched_summary`, `rag_sources`, `rag_last_updated_at`
- [ ] Validate frontend: `CallDetail` shows "Resumo RAG (transcrição)"
- [ ] Validate structured logs in Supabase dashboard include:
  - [ ] `call_id`
  - [ ] `step`
  - [ ] `status`
  - [ ] `duration_ms`
- [ ] Compare remote snapshot against baseline for unexpected diffs

## Rollback criteria (trigger rollback if any)

- [ ] Repeated pipeline lock/stuck behavior for same call after safe retry
- [ ] RAG enrichment fails for controlled call with valid transcript
- [ ] Regression in critical frontend flows (dashboard/calls/pdi/insights)
- [ ] Unexpected schema drift affecting `calls`, `call_analysis`, `knowledge_*`, views

## Rollback actions

- [ ] Follow `ROLLBACK-CHECKLIST.md`
- [ ] Use `scripts/sql/02-safe-unlock-call.sql` for isolated stuck call recovery
- [ ] Register post-mortem notes in `RELEASE-EVIDENCE.md`

