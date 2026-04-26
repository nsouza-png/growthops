-- RAG vector store (canonical)
-- Stores file chunks and embeddings for semantic retrieval.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "GrowthPlatform".knowledge_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  bucket text NOT NULL,
  storage_path text NOT NULL,
  checksum text,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS "GrowthPlatform".knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  file_id uuid REFERENCES "GrowthPlatform".knowledge_files(id) ON DELETE CASCADE,
  source text NOT NULL,
  chunk_index int NOT NULL,
  content text NOT NULL,
  token_count int,
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding vector(1536) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source
  ON "GrowthPlatform".knowledge_chunks(source);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_file_id
  ON "GrowthPlatform".knowledge_chunks(file_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON "GrowthPlatform".knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count int DEFAULT 8,
  source_filter text DEFAULT NULL
)
RETURNS TABLE (
  chunk_id uuid,
  file_id uuid,
  source text,
  chunk_index int,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    kc.id AS chunk_id,
    kc.file_id,
    kc.source,
    kc.chunk_index,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM "GrowthPlatform".knowledge_chunks kc
  WHERE source_filter IS NULL OR kc.source = source_filter
  ORDER BY kc.embedding <=> query_embedding
  LIMIT GREATEST(match_count, 1);
$$;

GRANT SELECT, INSERT, UPDATE, DELETE
ON "GrowthPlatform".knowledge_files
TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON "GrowthPlatform".knowledge_chunks
TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(vector(1536), int, text)
TO authenticated, service_role;
