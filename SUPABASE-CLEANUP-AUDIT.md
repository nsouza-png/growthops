# Supabase Cleanup Audit (Safe Mode)

## Objective

Keep only objects required by current frontend/backend execution paths, without destructive drops yet.

This audit is based on:
- runtime references in `app/`
- runtime references in `supabase/functions/`
- SQL objects declared in `supabase/migrations/`

## 1) Objects currently used by frontend/backend (`KEEP`)

### Core tables/views (GrowthPlatform)
- `profiles`
- `user_roles`
- `calls`
- `call_analysis`
- `framework_scores`
- `behavior_signals`
- `business_analysis`
- `smart_alerts`
- `call_followups`
- `closer_pdis`
- `pipeline_events`
- `smart_trackers`
- `snippets`
- `snippet_assignments`
- `snippet_views`
- `call_feedback`
- `notifications`
- `pdi_focus_areas`
- `pdi_sprint_goals`
- `knowledge_files`
- `knowledge_chunks`
- `gp_market_intelligence`
- `gp_competitor_analyses`
- `gp_market_trends`
- `gp_win_loss_analyses`
- `unified_calls` (view)
- `urgent_calls` (view)

### RPCs/functions currently referenced
- `public.ensure_gp_profile`
- `public.get_gp_call_followups`
- `public.match_knowledge_chunks` / `"GrowthPlatform".match_knowledge_chunks`

### Edge Functions currently referenced by app/scripts
- `gp-generate-whatsapp`
- `gp-generate-pdi`
- `enrich-call`
- `analyze-call`
- `rag-*` flow (`rag-query`, `rag-enrich-call`, `rag-index-transcript`)

## 2) Objects that are required by backend shared libs (`KEEP`)

- `ai_usage_log` (used by `supabase/functions/_shared/ai-client.ts`)
- `api_keys` (used by `supabase/functions/_shared/api-keys.ts`)

## 3) Candidate legacy surface (`DEPRECATE` in safe mode)

### Legacy schema
- `growth_platform` (lowercase schema), if present in remote DB.

Rationale:
- canonical schema is `"GrowthPlatform"`.
- keeping a parallel legacy schema increases drift and accidental writes.

## 4) Known pipeline contract drift (not cleanup, but blocker)

The GP derived pipeline currently calls RPCs that are not present in migration history:
- `upsert_gp_call`
- `upsert_gp_framework_scores`
- `upsert_gp_behavior_signals`
- `upsert_gp_business_analysis`
- `insert_gp_pipeline_event`
- `insert_gp_call_followup`
- `insert_gp_closer_pdi`

This does **not** prevent safe cleanup audit, but blocks full GPT-derived backfill.

## 5) Safe cleanup strategy (this phase)

1. Do **not** drop tables/functions yet.
2. Quarantine legacy schema access (`growth_platform`) by revoking app roles.
3. Record deprecation candidates in a registry table.
4. Observe logs/errors in staging/production.
5. Only then run hard-drop migration in a second phase.

## 6) Hard-drop phase (later, explicit approval)

After 48-72h without regressions:
- drop deprecated schema/objects
- re-run smoke tests and release preflight

