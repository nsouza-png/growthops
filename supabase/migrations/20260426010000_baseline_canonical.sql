-- Canonical baseline migration for go-live.
-- Scope: only objects used by the current product flow.

CREATE SCHEMA IF NOT EXISTS "GrowthPlatform";

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Core identity/profile
CREATE TABLE IF NOT EXISTS "GrowthPlatform".profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  email text UNIQUE,
  full_name text,
  avatar_url text,
  role text DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS "GrowthPlatform".user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'executivo',
  email text,
  squad text,
  preferred_name text,
  is_active boolean DEFAULT true,
  onboarding_completed boolean DEFAULT false
);

-- Calls + analysis pipeline
CREATE TABLE IF NOT EXISTS "GrowthPlatform".calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  tldv_call_id text UNIQUE,
  tldv_url text,
  deal_id text,
  call_date timestamptz,
  duration_seconds integer,
  transcript_fetched boolean DEFAULT false,
  transcript_text text,
  transcript_quality text,
  seller_email text NOT NULL,
  seller_name text,
  closer_email text,
  squad text,
  deal_stage text,
  deal_status text,
  deal_acv numeric,
  lead_perfil text,
  lead_faixa text,
  lead_segmento text,
  produto_oferecido text,
  utm_campaign text,
  origem_da_receita text,
  segment text,
  prospect_name text,
  prospect_company text,
  processing_status text DEFAULT 'pending',
  processing_stage text DEFAULT 'pending',
  processed_at timestamptz,
  status text DEFAULT 'active',
  data_source text
);

CREATE TABLE IF NOT EXISTS "GrowthPlatform".call_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  call_id uuid UNIQUE REFERENCES "GrowthPlatform".calls(id) ON DELETE CASCADE,
  summary_text text,
  client_pains jsonb,
  next_steps jsonb,
  critical_moments jsonb,
  talk_ratio_seller numeric,
  talk_ratio_client numeric,
  longest_monologue_s integer,
  questions_count integer,
  competitors jsonb,
  objections jsonb,
  churn_signals jsonb,
  buy_intent_signals jsonb,
  smart_trackers_detected text[],
  behavior_analysis jsonb,
  business_outcome jsonb,
  followup_draft text,
  model_version text,
  analysis_version integer DEFAULT 1
);

CREATE TABLE IF NOT EXISTS "GrowthPlatform".framework_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  call_id uuid UNIQUE REFERENCES "GrowthPlatform".calls(id) ON DELETE CASCADE,
  spiced_situation numeric,
  spiced_pain numeric,
  spiced_impact numeric,
  spiced_critical_event numeric,
  spiced_decision numeric,
  spiced_total numeric,
  spin_situation numeric,
  spin_problem numeric,
  spin_implication numeric,
  spin_need_payoff numeric,
  spin_total numeric,
  challenger_teach numeric,
  challenger_tailor numeric,
  challenger_take_control numeric,
  challenger_total numeric
);

-- Collaboration and coaching
CREATE TABLE IF NOT EXISTS "GrowthPlatform".smart_trackers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  description text,
  category text DEFAULT 'custom',
  is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS "GrowthPlatform".snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  call_id uuid REFERENCES "GrowthPlatform".calls(id) ON DELETE CASCADE,
  text text,
  title text,
  transcript_excerpt text,
  tag text,
  timestamp_s integer,
  start_second integer,
  end_second integer,
  created_by uuid REFERENCES auth.users(id),
  is_featured boolean DEFAULT false,
  is_public boolean DEFAULT false,
  approved_at timestamptz,
  assigned_to text
);

CREATE TABLE IF NOT EXISTS "GrowthPlatform".snippet_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  snippet_id uuid REFERENCES "GrowthPlatform".snippets(id) ON DELETE CASCADE,
  assigned_to text,
  assigned_to_email text,
  assigned_by uuid REFERENCES auth.users(id),
  assigned_by_email text,
  note text
);

CREATE TABLE IF NOT EXISTS "GrowthPlatform".snippet_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  snippet_id uuid REFERENCES "GrowthPlatform".snippets(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_by_email text,
  watch_time_seconds integer DEFAULT 0,
  completed boolean DEFAULT false,
  viewed_at timestamptz DEFAULT now(),
  UNIQUE (snippet_id, user_id)
);

CREATE TABLE IF NOT EXISTS "GrowthPlatform".call_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  call_id uuid REFERENCES "GrowthPlatform".calls(id) ON DELETE CASCADE,
  author_email text,
  text text NOT NULL,
  type text DEFAULT 'comment'
);

CREATE TABLE IF NOT EXISTS "GrowthPlatform".notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_email text NOT NULL,
  title text NOT NULL,
  body text,
  kind text,
  is_read boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS "GrowthPlatform".smart_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  call_id uuid REFERENCES "GrowthPlatform".calls(id) ON DELETE CASCADE,
  seller_email text,
  severity text,
  message text,
  is_resolved boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS "GrowthPlatform".pdi_focus_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  seller_email text NOT NULL,
  area text NOT NULL,
  status text DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS "GrowthPlatform".pdi_sprint_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  seller_email text NOT NULL,
  goal text NOT NULL,
  status text DEFAULT 'planned',
  due_date date
);

-- Pipeline support entities used by services
CREATE TABLE IF NOT EXISTS "GrowthPlatform".call_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  call_id uuid REFERENCES "GrowthPlatform".calls(id) ON DELETE CASCADE,
  followup_text text NOT NULL,
  generated_by text DEFAULT 'llm'
);

CREATE TABLE IF NOT EXISTS "GrowthPlatform".closer_pdis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  seller_email text NOT NULL,
  week_ref text NOT NULL,
  pdi jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "GrowthPlatform".pipeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  call_id uuid REFERENCES "GrowthPlatform".calls(id) ON DELETE CASCADE,
  step text NOT NULL,
  status text NOT NULL,
  duration_ms integer
);

CREATE TABLE IF NOT EXISTS "GrowthPlatform".behavior_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  call_id uuid UNIQUE REFERENCES "GrowthPlatform".calls(id) ON DELETE CASCADE,
  talk_ratio_seller_pct numeric,
  peeling_depth_levels integer,
  transitions_detected integer,
  name_usage_count integer,
  seller_profile text,
  top_signals jsonb,
  unified_score numeric,
  unified_score_max numeric,
  unified_score_band text
);

CREATE TABLE IF NOT EXISTS "GrowthPlatform".business_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  call_id uuid UNIQUE REFERENCES "GrowthPlatform".calls(id) ON DELETE CASCADE,
  market_intelligence jsonb,
  competitor_analyses jsonb,
  market_trends jsonb,
  win_loss_analyses jsonb
);

-- Views used by frontend
CREATE OR REPLACE VIEW "GrowthPlatform".unified_calls AS
SELECT
  c.id,
  c.created_at,
  c.updated_at,
  c.seller_name AS vendedor,
  c.prospect_name AS lead,
  c.call_date AS data,
  c.deal_id,
  c.closer_email,
  c.processing_status,
  c.processing_stage,
  c.call_date AS sort_date,
  COALESCE(c.data_source, 'webhook_pipeline') AS data_source,
  ca.summary_text AS resumo,
  ca.client_pains,
  ca.next_steps AS proximos_passos,
  ca.critical_moments,
  ca.talk_ratio_seller,
  ca.talk_ratio_client,
  ca.longest_monologue_s,
  ca.questions_count,
  ca.competitors,
  ca.objections,
  ca.churn_signals,
  ca.buy_intent_signals,
  ca.smart_trackers_detected,
  ca.behavior_analysis,
  ca.business_outcome,
  ca.followup_draft,
  ca.model_version,
  ca.analysis_version,
  fs.spiced_total AS score_geral,
  fs.spiced_total,
  fs.spiced_situation,
  fs.spiced_pain,
  fs.spiced_impact,
  fs.spiced_critical_event,
  fs.spiced_decision,
  fs.spin_situation,
  fs.spin_problem,
  fs.spin_implication,
  fs.spin_need_payoff,
  fs.spin_total,
  fs.challenger_teach,
  fs.challenger_tailor,
  fs.challenger_take_control,
  fs.challenger_total
FROM "GrowthPlatform".calls c
LEFT JOIN "GrowthPlatform".call_analysis ca ON ca.call_id = c.id
LEFT JOIN "GrowthPlatform".framework_scores fs ON fs.call_id = c.id;

CREATE OR REPLACE VIEW "GrowthPlatform".urgent_calls AS
SELECT
  c.id AS call_id,
  c.prospect_name AS lead,
  c.closer_email,
  c.squad,
  c.deal_acv,
  c.deal_stage,
  c.deal_status,
  c.call_date AS happened_at,
  ca.buy_intent_signals,
  fs.spiced_total,
  fs.spiced_pain,
  fs.spiced_critical_event,
  CASE
    WHEN COALESCE(fs.spiced_total, 10) < 4 THEN 'critico'
    WHEN COALESCE(fs.spiced_total, 10) < 6 THEN 'atencao'
    ELSE 'ok'
  END AS priority_level,
  COALESCE(c.deal_acv, 0) * (10 - COALESCE(fs.spiced_total, 5)) AS priority_score
FROM "GrowthPlatform".calls c
LEFT JOIN "GrowthPlatform".call_analysis ca ON ca.call_id = c.id
LEFT JOIN "GrowthPlatform".framework_scores fs ON fs.call_id = c.id
WHERE c.status = 'active';

CREATE OR REPLACE VIEW "GrowthPlatform".squad_performance AS
SELECT
  COALESCE(c.squad, 'sem_squad') AS squad,
  COUNT(*)::int AS calls_count,
  AVG(fs.spiced_total)::numeric AS avg_spiced_total
FROM "GrowthPlatform".calls c
LEFT JOIN "GrowthPlatform".framework_scores fs ON fs.call_id = c.id
GROUP BY COALESCE(c.squad, 'sem_squad');

-- RPCs used by frontend
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_seller_email text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'total_calls', COUNT(*)::int,
    'avg_score', COALESCE(AVG(fs.spiced_total), 0),
    'with_feedback', COUNT(cf.id)::int
  )
  FROM "GrowthPlatform".calls c
  LEFT JOIN "GrowthPlatform".framework_scores fs ON fs.call_id = c.id
  LEFT JOIN "GrowthPlatform".call_feedback cf ON cf.call_id = c.id
  WHERE p_seller_email IS NULL OR c.seller_email = p_seller_email;
$$;

CREATE OR REPLACE FUNCTION public.get_weekly_evolution(p_seller_email text DEFAULT NULL)
RETURNS TABLE(week text, avg_score numeric, call_count int)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    to_char(date_trunc('week', c.call_date), 'IYYY-IW') AS week,
    COALESCE(AVG(fs.spiced_total), 0) AS avg_score,
    COUNT(*)::int AS call_count
  FROM "GrowthPlatform".calls c
  LEFT JOIN "GrowthPlatform".framework_scores fs ON fs.call_id = c.id
  WHERE c.call_date IS NOT NULL
    AND (p_seller_email IS NULL OR c.seller_email = p_seller_email)
  GROUP BY date_trunc('week', c.call_date)
  ORDER BY date_trunc('week', c.call_date);
$$;

CREATE OR REPLACE FUNCTION public.get_gp_call_followups(p_call_id uuid)
RETURNS SETOF "GrowthPlatform".call_followups
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT *
  FROM "GrowthPlatform".call_followups
  WHERE call_id = p_call_id
  ORDER BY created_at DESC;
$$;

-- Updated-at trigger helper
CREATE OR REPLACE FUNCTION "GrowthPlatform".set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON "GrowthPlatform".profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON "GrowthPlatform".profiles
FOR EACH ROW
EXECUTE FUNCTION "GrowthPlatform".set_updated_at();

DROP TRIGGER IF EXISTS trg_calls_updated_at ON "GrowthPlatform".calls;
CREATE TRIGGER trg_calls_updated_at
BEFORE UPDATE ON "GrowthPlatform".calls
FOR EACH ROW
EXECUTE FUNCTION "GrowthPlatform".set_updated_at();

DROP TRIGGER IF EXISTS trg_user_roles_updated_at ON "GrowthPlatform".user_roles;
CREATE TRIGGER trg_user_roles_updated_at
BEFORE UPDATE ON "GrowthPlatform".user_roles
FOR EACH ROW
EXECUTE FUNCTION "GrowthPlatform".set_updated_at();

-- Grants
GRANT USAGE ON SCHEMA "GrowthPlatform" TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "GrowthPlatform" TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON "GrowthPlatform".unified_calls TO authenticated, service_role;
GRANT SELECT ON "GrowthPlatform".urgent_calls TO authenticated, service_role;
GRANT SELECT ON "GrowthPlatform".squad_performance TO authenticated, service_role;
