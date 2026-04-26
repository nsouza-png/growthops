-- Schema Alignment: create missing tables referenced by application code,
-- drop unused view squad_performance.

-- ── 1. ai_usage_log (used by _shared/ai-client.ts for rate-limiting) ─────────

CREATE TABLE IF NOT EXISTS "GrowthPlatform".ai_usage_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  function_name text NOT NULL,
  tokens_used integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user_fn_created
  ON "GrowthPlatform".ai_usage_log (user_id, function_name, created_at DESC);

-- ── 2. api_keys (used by _shared/api-keys.ts) ───────────────────────────────

CREATE TABLE IF NOT EXISTS "GrowthPlatform".api_keys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  key_hash    text NOT NULL UNIQUE,
  permissions text[] NOT NULL DEFAULT '{}',
  rate_limit  integer NOT NULL DEFAULT 100,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid,
  last_used_at timestamptz,
  expires_at  timestamptz,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 3. gp_market_intelligence (parent table for market intel feature) ────────

CREATE TABLE IF NOT EXISTS "GrowthPlatform".gp_market_intelligence (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 4. gp_competitor_analyses ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "GrowthPlatform".gp_competitor_analyses (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_intelligence_id  uuid NOT NULL REFERENCES "GrowthPlatform".gp_market_intelligence(id) ON DELETE CASCADE,
  competitor_name         text NOT NULL,
  website                 text,
  funding_stage           text,
  team_size               integer,
  key_features            text[] NOT NULL DEFAULT '{}',
  strengths               text[] NOT NULL DEFAULT '{}',
  weaknesses              text[] NOT NULL DEFAULT '{}',
  market_position         text NOT NULL DEFAULT 'entrada',
  threat_level            text NOT NULL DEFAULT 'baixo',
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- ── 5. gp_market_trends ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "GrowthPlatform".gp_market_trends (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_intelligence_id  uuid NOT NULL REFERENCES "GrowthPlatform".gp_market_intelligence(id) ON DELETE CASCADE,
  trend_name              text NOT NULL,
  category                text NOT NULL DEFAULT 'mercado',
  description             text NOT NULL DEFAULT '',
  impact_level            text NOT NULL DEFAULT 'baixo',
  time_horizon            text NOT NULL DEFAULT 'médio',
  data_sources            text[] NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- ── 6. gp_win_loss_analyses ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "GrowthPlatform".gp_win_loss_analyses (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_intelligence_id  uuid NOT NULL REFERENCES "GrowthPlatform".gp_market_intelligence(id) ON DELETE CASCADE,
  deal_id                 text,
  competitor_name         text NOT NULL,
  outcome                 text NOT NULL DEFAULT 'loss',
  reason_category         text NOT NULL DEFAULT 'outro',
  specific_reason         text NOT NULL DEFAULT '',
  lessons_learned         text[] NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- ── 7. Drop unused view ─────────────────────────────────────────────────────

DROP VIEW IF EXISTS "GrowthPlatform".squad_performance;

-- ── 8. RLS policies for new tables ──────────────────────────────────────────

ALTER TABLE "GrowthPlatform".ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GrowthPlatform".api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GrowthPlatform".gp_market_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GrowthPlatform".gp_competitor_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GrowthPlatform".gp_market_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GrowthPlatform".gp_win_loss_analyses ENABLE ROW LEVEL SECURITY;

-- Service role bypass (edge functions use service_role key)
CREATE POLICY "service_role_all" ON "GrowthPlatform".ai_usage_log
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON "GrowthPlatform".api_keys
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON "GrowthPlatform".gp_market_intelligence
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON "GrowthPlatform".gp_competitor_analyses
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON "GrowthPlatform".gp_market_trends
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON "GrowthPlatform".gp_win_loss_analyses
  FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can read market intelligence data
CREATE POLICY "authenticated_read" ON "GrowthPlatform".gp_market_intelligence
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_read" ON "GrowthPlatform".gp_competitor_analyses
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_read" ON "GrowthPlatform".gp_market_trends
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_read" ON "GrowthPlatform".gp_win_loss_analyses
  FOR SELECT USING (auth.role() = 'authenticated');
