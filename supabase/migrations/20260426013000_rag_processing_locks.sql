-- RAG idempotency locks to prevent parallel reprocessing spam.

ALTER TABLE "GrowthPlatform".calls
  ADD COLUMN IF NOT EXISTS rag_index_status text DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS rag_index_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS rag_enrich_status text DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS rag_enrich_started_at timestamptz;
