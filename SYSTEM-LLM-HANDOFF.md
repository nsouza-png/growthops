# GrowthOps - LLM Handoff (End-to-End)

## Purpose

This file is the canonical handoff for any LLM agent working on this project.
It explains what the system does, how data flows end-to-end, what is production-canonical, and what must not be broken.

## Product Goal

GrowthOps is a call intelligence and coaching platform.
It ingests sales calls (tl;dv), enriches and analyzes them, scores methodology quality, generates coaching outputs, and exposes actionable insights in the frontend.

## Canonical Local Source of Truth

- Project root: `growthops-main`
- Canonical DB migrations: `supabase/migrations/`
- Canonical edge functions: `supabase/functions/`
- Frontend app: `app/`
- Operational scripts: `scripts/`

There is no second migration or functions tree in-repo: only `supabase/migrations/` and `supabase/functions/` are authoritative.

## Runtime Stack

- Frontend: React + TypeScript + Vite
- Backend: Supabase (Postgres + Edge Functions + Storage)
- AI:
  - OpenAI embeddings (`text-embedding-3-small`)
  - OpenAI chat: `gpt-4.1-mini` for RAG (`rag-enrich-call`, `rag-query`) and framework/behavior scoring (`gp-score-*`, `gp-map-behavior-signals`); other flows use `gpt-4` or `OPENAI_MODEL` where configured (`analyze-call`, etc.). All LLM calls in Edge Functions go through OpenAI (`OPENAI_API_KEY`).
- Text splitting: deterministic chunking (not LLM chunking)

## Database Contract (Current)

Primary schema is `GrowthPlatform`.

Main entities:

- `calls`
- `call_analysis`
- `framework_scores`
- `behavior_signals`
- `business_analysis`
- `snippets`, `snippet_assignments`, `snippet_views`
- `pdi_focus_areas`, `pdi_sprint_goals`
- `knowledge_files`, `knowledge_chunks` (RAG vector store)

RAG output columns in `call_analysis`:

- `rag_enriched_summary` (text shown in frontend)
- `rag_sources` (jsonb source traceability)
- `rag_last_updated_at` (timestamp)

Key views:

- `unified_calls`
- `urgent_calls`
- `squad_performance`

## End-to-End Pipeline

1. `tldv-webhook`
   - receives tl;dv events
   - upserts `calls` with meeting metadata
   - triggers `enrich-call` for transcript-ready flow

2. `enrich-call`
   - enriches deal context
   - triggers `fetch-transcript`

3. `fetch-transcript`
   - fetches transcript segments from tl;dv API
   - computes behavior basics
   - upserts `call_analysis` transcript data
   - stores plain transcript in `calls.transcript_text`
   - triggers:
     - `analyze-call`
     - `rag-index-transcript`

4. `rag-index-transcript`
   - reads `calls.transcript_text`
   - chunks deterministically with:
     - `chunkSize = 500`
     - `chunkOverlap = 150`
   - creates embeddings
   - writes chunks into `knowledge_chunks`
   - triggers `rag-enrich-call`

5. `rag-enrich-call`
   - retrieves top relevant chunks via `match_knowledge_chunks`
   - runs LLM synthesis over retrieved context only
   - writes result to `call_analysis.rag_enriched_summary`
   - writes traceability to `call_analysis.rag_sources`

6. Frontend consumption
   - `app/src/pages/CallDetail.tsx` renders "Resumo RAG (transcrição)" when available

## RAG Design Rules (Do Not Regress)

- Chunk at ingestion time, never at query time.
- Do not store full long transcripts as one vector row.
- Use deterministic splitter, not LLM for splitting.
- Keep source traceability (`rag_sources`) for explainability/audit.
- Keep embedding model dimension consistent with DB vector dimension (1536).

## Quality Baseline (Local)

Current validated baseline:

- `npx tsc --noEmit` passes
- `npx vitest run` passes (frontend suite)
- `npx playwright test --project=chromium` passes (smoke suite)
- `npm run rag:dry-run -- <dataset>` passes with 500/150 chunking

## Required Environment Variables (for real RAG runtime)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

Optional tuning:

- `RAG_CHUNK_SIZE` (default 500)
- `RAG_CHUNK_OVERLAP` (default 150)
- `RAG_BUCKET` (default `rag-files`)
- `RAG_MATCH_TOP_K_DEFAULT` (default 8)
- `RAG_MATCH_TOP_K_CAP` (default 12; recommendation: dev=12, staging=10, prod=8)

## Operational Commands

From project root:

- `npm run validate:pdi-dataset`
- `npm run rag:dry-run -- "<source_dir>"`
- `npm run rag:ingest -- "<source_dir>"`
- `npm run pipeline:health`
- `npm run rag:runtime-check -- <call_id>`
- `npm run preflight:go-live`
- `npm run preflight:release`
- `npm run snapshot:schema`
- `npm run snapshot:schema:linked`

From `app/`:

- `npx tsc --noEmit`
- `npx vitest run`
- `npx playwright test --project=chromium`

## Guardrails for Future LLMs

- Do not reintroduce legacy Supabase project refs or hardcoded JWTs.
- Do not relax typing to bypass compile safety.
- Do not switch chunking back to large monolithic transcript rows.
- Do not write secrets into migrations, source code, or docs.
- Keep `GrowthPlatform` as explicit schema target.

## What "Ready to Push to Supabase" Means

Only proceed when all are true:

1. Typecheck passes
2. Unit/integration tests pass
3. E2E smoke passes
4. RAG ingest real run succeeds
5. RAG output is visible in frontend for a real call
6. No legacy garbage is introduced in canonical folders

---

If you are an LLM agent, read this file first, then map any change request to this pipeline before editing code.
