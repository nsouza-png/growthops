-- Baseline RLS policies: authenticated can read all, service_role has full access.
-- Write policies (INSERT/UPDATE) added only for tables the frontend writes to.

-- Helper: for each table, create SELECT policy for authenticated + ALL for service_role
-- Tables that frontend writes to also get INSERT/UPDATE for authenticated.

-- === Core tables (read-only for authenticated via frontend) ===
CREATE POLICY authenticated_read ON "GrowthPlatform".profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".user_roles FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".calls FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".calls FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".call_analysis FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".call_analysis FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".framework_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".framework_scores FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".smart_trackers FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".smart_trackers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- === Tables with frontend writes ===
CREATE POLICY authenticated_read ON "GrowthPlatform".snippets FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_insert ON "GrowthPlatform".snippets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY service_role_all ON "GrowthPlatform".snippets FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".snippet_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_insert ON "GrowthPlatform".snippet_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY service_role_all ON "GrowthPlatform".snippet_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".snippet_views FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_insert ON "GrowthPlatform".snippet_views FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY authenticated_update ON "GrowthPlatform".snippet_views FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON "GrowthPlatform".snippet_views FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".call_feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_insert ON "GrowthPlatform".call_feedback FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY service_role_all ON "GrowthPlatform".call_feedback FOR ALL TO service_role USING (true) WITH CHECK (true);

-- === Read-only tables ===
CREATE POLICY authenticated_read ON "GrowthPlatform".notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".notifications FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".smart_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".smart_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".pdi_focus_areas FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".pdi_focus_areas FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".pdi_sprint_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".pdi_sprint_goals FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".call_followups FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".call_followups FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".closer_pdis FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".closer_pdis FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".pipeline_events FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".pipeline_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".behavior_signals FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".behavior_signals FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".business_analysis FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".business_analysis FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".knowledge_files FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".knowledge_files FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".knowledge_chunks FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".knowledge_chunks FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".ai_usage_log FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".ai_usage_log FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".api_keys FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".api_keys FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".gp_market_intelligence FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".gp_market_intelligence FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".gp_competitor_analyses FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".gp_competitor_analyses FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".gp_market_trends FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".gp_market_trends FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY authenticated_read ON "GrowthPlatform".gp_win_loss_analyses FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_all ON "GrowthPlatform".gp_win_loss_analyses FOR ALL TO service_role USING (true) WITH CHECK (true);
