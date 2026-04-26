-- Safe unlock template for one call_id in GrowthPlatform.
-- Usage:
--   1) Replace __CALL_ID__ with the target UUID
--   2) Run manually in controlled window after confirming no active function execution for that call

BEGIN;

UPDATE "GrowthPlatform".calls
SET
  processing_status = 'pending',
  rag_index_status = 'failed',
  rag_index_started_at = NULL,
  rag_enrich_status = 'failed',
  rag_enrich_started_at = NULL,
  updated_at = now()
WHERE id = '__CALL_ID__';

-- Optional visibility check
SELECT
  id,
  processing_status,
  rag_index_status,
  rag_index_started_at,
  rag_enrich_status,
  rag_enrich_started_at,
  updated_at
FROM "GrowthPlatform".calls
WHERE id = '__CALL_ID__';

COMMIT;

