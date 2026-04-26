# Operational Scripts

Scripts in this folder are operational-only and intentionally minimal.

- `gen-db.js`: regenerates `app/src/types/database.ts` from the canonical local contract.
- `rag-ingest.js`: ingests local files into Supabase Storage, splits text with LangChain (default chunk 500 / overlap 150), and writes OpenAI embeddings to the vector store.
- `check-release-env.js`: validates required env vars for release gate.
- `preflight-go-live.js`: local consolidated quality checks.
- `preflight-release.js`: strict release gate (includes authenticated E2E + runtime RAG validation).
- `validate-rag-pipeline-runtime.js`: validates one real call end-to-end in runtime and checks `rag_*` columns.
- `enrich-lock-decision.unit.test.mjs`: unit test matrix for `canStartEnrich(status)` allowed/blocked states.
- `enrich-lock-idempotency.test.js`: integration test to verify `enrich-call` lock skips duplicate trigger for same `call_id`.
- `pipeline-health-stuck.js`: lists potentially stuck calls by status/lock timestamps.
- `snapshot-gp-schema.js`: exports schema snapshot/baseline copy for post-deploy diff.
- `sql/01-wipe-project-scope.sql`: destructive cleanup for project scope in Supabase (manual use only).

Conventions:

- Keep only scripts that are used in current flow.
- Prefix SQL scripts with numeric order (`01-`, `02-`, ...).
- Do not store one-off or experimental scripts here.
