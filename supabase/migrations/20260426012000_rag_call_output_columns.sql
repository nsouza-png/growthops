-- Add explicit RAG output columns for call-level enrichment shown in frontend.

ALTER TABLE "GrowthPlatform".call_analysis
  ADD COLUMN IF NOT EXISTS rag_enriched_summary text,
  ADD COLUMN IF NOT EXISTS rag_sources jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rag_last_updated_at timestamptz;
