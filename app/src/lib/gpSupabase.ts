// ── GrowthPlatform Supabase Client ───────────────────────────────────────────
// GrowthPlatform tables are exposed as public views with the gp_ prefix
// (migration 20260421000003), so we use the standard public-schema client.
// No Accept-Profile header needed — everything goes through public schema.

export { supabase as gpSupabase } from './supabase'
