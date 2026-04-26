-- Align Game Film runtime contract (frontend <-> GrowthPlatform schema).

ALTER TABLE "GrowthPlatform".snippets
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS transcript_excerpt text,
  ADD COLUMN IF NOT EXISTS start_second integer,
  ADD COLUMN IF NOT EXISTS end_second integer,
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_to text;

ALTER TABLE "GrowthPlatform".snippets
  ALTER COLUMN text DROP NOT NULL;

ALTER TABLE "GrowthPlatform".snippet_assignments
  ADD COLUMN IF NOT EXISTS assigned_to text,
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "GrowthPlatform".snippet_assignments
  ALTER COLUMN assigned_to_email DROP NOT NULL;

ALTER TABLE "GrowthPlatform".snippet_views
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS watch_time_seconds integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz DEFAULT now();

ALTER TABLE "GrowthPlatform".snippet_views
  ALTER COLUMN viewed_by_email DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'snippet_views_snippet_id_user_id_key'
  ) THEN
    ALTER TABLE "GrowthPlatform".snippet_views
      ADD CONSTRAINT snippet_views_snippet_id_user_id_key UNIQUE (snippet_id, user_id);
  END IF;
END $$;

