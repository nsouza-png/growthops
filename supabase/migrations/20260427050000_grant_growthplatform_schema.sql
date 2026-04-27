-- Grant GrowthPlatform schema access to PostgREST roles
-- Required for the REST API to accept Accept-Profile: GrowthPlatform

GRANT USAGE ON SCHEMA "GrowthPlatform" TO anon, authenticated, service_role;

-- Read access for anon + authenticated
GRANT SELECT ON ALL TABLES IN SCHEMA "GrowthPlatform" TO anon, authenticated;

-- Write access for authenticated on application tables
GRANT INSERT, UPDATE, DELETE ON TABLE
  "GrowthPlatform".calls,
  "GrowthPlatform".call_analysis,
  "GrowthPlatform".call_feedback,
  "GrowthPlatform".call_followups,
  "GrowthPlatform".framework_scores,
  "GrowthPlatform".notifications,
  "GrowthPlatform".pdi_focus_areas,
  "GrowthPlatform".pdi_sprint_goals,
  "GrowthPlatform".snippets,
  "GrowthPlatform".snippet_assignments,
  "GrowthPlatform".snippet_views,
  "GrowthPlatform".smart_alerts,
  "GrowthPlatform".smart_trackers,
  "GrowthPlatform".profiles,
  "GrowthPlatform".user_roles,
  "GrowthPlatform".knowledge_files,
  "GrowthPlatform".knowledge_chunks,
  "GrowthPlatform".pipeline_events,
  "GrowthPlatform".closer_pdis,
  "GrowthPlatform".behavior_signals,
  "GrowthPlatform".business_analysis,
  "GrowthPlatform".gp_competitor_analyses,
  "GrowthPlatform".gp_market_intelligence,
  "GrowthPlatform".gp_market_trends,
  "GrowthPlatform".gp_win_loss_analyses
TO authenticated;

-- Full access for service_role (edge functions)
GRANT ALL ON ALL TABLES IN SCHEMA "GrowthPlatform" TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "GrowthPlatform" TO authenticated, service_role;

-- Ensure future tables also get granted
ALTER DEFAULT PRIVILEGES IN SCHEMA "GrowthPlatform"
  GRANT SELECT ON TABLES TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA "GrowthPlatform"
  GRANT INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA "GrowthPlatform"
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA "GrowthPlatform"
  GRANT ALL ON SEQUENCES TO authenticated, service_role;
