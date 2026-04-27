// ── GrowthPlatform Schema — Supabase typed database ─────────────────────────
// Used exclusively by gpSupabase client (src/lib/gpSupabase.ts)
// Maps the 8 tables in the "GrowthPlatform" Postgres schema (migration 20260421000001)

type T<R> = {
  Row: R & Record<string, unknown>
  Insert: Partial<R> & Record<string, unknown>
  Update: Partial<R> & Record<string, unknown>
  Relationships: never[]
}

// ── Row types ─────────────────────────────────────────────────────────────────

export interface GPProfile {
  id: string
  email: string
  name: string
  cargo: string
  role: 'executivo' | 'coordenador' | 'gerente' | 'diretor' | 'sales_ops' | 'admin'
  squad: string | null
  setor: string | null
  lider_direto: string | null
  data_entrada: string | null    // DATE as ISO string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface GPCall {
  id: string
  tldv_call_id: string | null
  seller_email: string
  seller_name: string
  prospect_name: string | null
  prospect_company: string | null
  segment: string | null         // Enterprise | Mid-Market | SMB
  call_date: string | null       // DATE as ISO string
  duration_min: number | null
  data_source: string | null
  word_count: number | null
  transcript_quality: string | null   // high | medium | low
  transcript_text: string | null
  processing_status: 'pending' | 'processing' | 'done' | 'error'
  created_at: string
  updated_at: string
}

export interface GPFrameworkScores {
  id: string
  call_id: string
  // SPICED
  spiced_situation_score: number | null
  spiced_pain_score: number | null
  spiced_impact_score: number | null
  spiced_critical_event_score: number | null
  spiced_decision_score: number | null
  spiced_delivery_score: number | null
  spiced_total: number | null
  spiced_pct: number | null
  spiced_classification: string | null
  spiced_weak_dimension: string | null
  spiced_red_flags: unknown[] | null
  spiced_highlights: unknown[] | null
  spiced_coaching_rec: string | null
  spiced_next_steps: string | null
  // SPIN
  spin_situation_count: number | null
  spin_problem_count: number | null
  spin_implication_count: number | null
  spin_need_payoff_count: number | null
  spin_sequence_analysis: string | null
  spin_total_score: number | null
  spin_missed_questions: unknown[] | null
  spin_coaching_priority: string | null
  // Challenger
  challenger_teach_score: number | null
  challenger_tailor_score: number | null
  challenger_control_score: number | null
  challenger_total: number | null
  challenger_classification: string | null
  challenger_red_flags: unknown[] | null
  challenger_coaching_rec: string | null
  // Consolidated
  overall_quality: string | null
  top_strength: string | null
  top_gap: string | null
  priority_coaching: string | null
  deal_risk: string | null
  cross_framework_insight: string | null
  raw_json: Record<string, unknown> | null
  created_at: string
}

export interface GPBehaviorSignals {
  id: string
  call_id: string
  talk_ratio_seller_pct: number | null
  peeling_depth_levels: number | null
  transitions_detected: number | null
  name_usage_count: number | null
  seller_profile: string | null
  top_signals: unknown[] | null
  unified_score: number | null
  unified_score_max: number | null
  unified_score_band: string | null
  created_at: string
}

export interface GPBusinessAnalysis {
  id: string
  call_id: string
  deal_stage: string | null
  estimated_arr: number | null
  budget_mentioned: boolean | null
  timeline_urgency: string | null
  stakeholders: unknown[] | null
  pain_business_case: string | null
  roi_signals: unknown[] | null
  next_action: {
    action: string
    owner: string
    deadline: string
    channel: string
  } | null
  raw_json: Record<string, unknown> | null
  created_at: string
}

export interface GPCallFollowup {
  id: string
  call_id: string
  channel: 'whatsapp' | 'email'
  content: string
  generated_by: string | null
  sent_at: string | null
  created_at: string
}

export interface GPCloserPDI {
  id: string
  call_id: string
  seller_email: string
  pdi_content: {
    priorities: unknown[]
    exercises: unknown[]
    timeline: string
    focus_areas: string[]
  }
  period: string | null
  generated_by: string | null
  created_at: string
}

export interface GPPipelineEvent {
  id: string
  call_id: string | null
  step: string
  status: 'started' | 'success' | 'error'
  payload: Record<string, unknown> | null
  error_msg: string | null
  duration_ms: number | null
  created_at: string
}

// ── Database type for typed Supabase client ───────────────────────────────────

export type GrowthPlatformDatabase = {
  GrowthPlatform: {
    Tables: {
      profiles:          T<GPProfile>
      calls:             T<GPCall>
      framework_scores:  T<GPFrameworkScores>
      behavior_signals:  T<GPBehaviorSignals>
      business_analysis: T<GPBusinessAnalysis>
      call_followups:    T<GPCallFollowup>
      closer_pdis:       T<GPCloserPDI>
      pipeline_events:   T<GPPipelineEvent>
    }
    Views: Record<string, never>
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
