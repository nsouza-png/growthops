-- Move match_knowledge_chunks to GrowthPlatform schema so it's accessible
-- via the Supabase client configured with db.schema = 'GrowthPlatform'

CREATE OR REPLACE FUNCTION "GrowthPlatform".match_knowledge_chunks(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  source_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  file_id uuid,
  content text,
  source text,
  chunk_index int,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.file_id,
    kc.content,
    kc.source,
    kc.chunk_index,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM "GrowthPlatform".knowledge_chunks kc
  WHERE (source_filter IS NULL OR kc.source ILIKE '%' || source_filter || '%')
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION "GrowthPlatform".match_knowledge_chunks(vector(1536), int, text)
  TO authenticated, service_role;
