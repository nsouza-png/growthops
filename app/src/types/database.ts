export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type AnyRow = Record<string, any>
type GenericTable<Row extends AnyRow = AnyRow> = {
  Row: Row
  Insert: Partial<Row>
  Update: Partial<Row>
  Relationships: []
}

type GenericView<Row extends AnyRow = AnyRow> = {
  Row: Row
  Relationships: []
}

export type AppSchema = {
  Tables: Record<string, GenericTable> & {
    calls: GenericTable<{
      id: string
      seller_email: string
      seller_name: string | null
      lead: string | null
      prospect_name: string | null
      deal_id: string | null
      lead_perfil: string | null
      lead_segmento: string | null
      lead_faixa: string | null
      deal_acv: number | null
      produto_oferecido: string | null
      deal_stage: string | null
      deal_status: string | null
      processing_status: string | null
      rag_index_status?: string | null
      rag_index_started_at?: string | null
      rag_enrich_status?: string | null
      rag_enrich_started_at?: string | null
      transcript_fetched?: boolean | null
      transcript_text?: string | null
      closer_email: string | null
      created_at: string
      updated_at: string
      call_date: string | null
      happened_at: string | null
      duration_seconds: number | null
      tldv_meeting_id: string | null
      tldv_call_id?: string | null
      tldv_url: string | null
      status: string
    }>
    call_analysis: GenericTable<{
      id: string
      call_id: string
      created_at: string
      summary_text?: string | null
      client_pains?: Array<{ text: string; timestamp_s?: number }> | null
      next_steps?: Array<{ text: string; owner?: string; due_date?: string }> | null
      critical_moments?: Array<{ text: string; timestamp_s?: number; type?: string }> | null
      talk_ratio_seller?: number | null
      talk_ratio_client?: number | null
      longest_monologue_s?: number | null
      questions_count?: number | null
      competitors?: Array<{ name: string; quote?: string; timestamp_s?: number }> | null
      objections?: Array<{ text: string; timestamp_s?: number }> | null
      churn_signals?: Array<{ text: string; timestamp_s?: number }> | null
      buy_intent_signals?: Array<{ text: string; timestamp_s?: number }> | null
      smart_trackers_detected?: string[] | null
      behavior_analysis?: Json | null
      business_outcome?: Json | null
      followup_draft?: string | null
      model_version?: string | null
      analysis_version?: number | null
      speaker_segments?: Array<{ speaker: string; start_s: number; end_s: number }> | null
      transcript_raw?: Array<{ speaker: string; words: string; start_time?: number; end_time?: number }> | null
      analysis_json?: {
        call_metadata?: {
          seller_name?: string
          prospect_name?: string
          call_date?: string
          duration_min?: number
        }
        next_action?: {
          action: string
          timing: string
          main_argument: string
        }
        consolidated?: {
          deal_risk?: 'alto' | 'medio' | 'baixo' | string
          cross_framework_insight?: string
        }
        behavior_signals?: {
          talk_ratio_seller_pct?: number
        }
        spin?: {
          scores?: Record<string, unknown>
          question_map?: {
            situation?: { count?: number }
            implication?: { count?: number }
          }
          sequence_analysis?: {
            pitch_timing?: { estimated_pitch_minute?: number }
          }
        }
        spiced?: {
          classification?: {
            result?: string
            reason?: string
          }
          weak_dimension?: string
          deal_next_steps?: string[]
          call_highlights?: string[]
          scores?: {
            decision?: {
              prospect_role?: string
              buying_center_mapped?: boolean
              criteria_identified?: boolean
              gaps?: string[]
            }
          }
        }
        transcript_raw?: Array<{ speaker: string; words: string; start_time?: number; end_time?: number }>
        [key: string]: unknown
      } | null
      rag_enriched_summary?: string | null
      rag_sources?: Array<{ source: string; chunk_index: number; similarity: number }> | null
      rag_last_updated_at?: string | null
    }>
    framework_scores: GenericTable<{
      id: string
      call_id: string
      created_at: string
      closer_email?: string | null
      spiced_situation: number | null
      spiced_pain: number | null
      spiced_impact: number | null
      spiced_critical_event: number | null
      spiced_decision: number | null
      spiced_total: number | null
      spin_situation: number | null
      spin_problem: number | null
      spin_implication: number | null
      spin_need_payoff: number | null
      spin_total: number | null
      challenger_teach: number | null
      challenger_tailor: number | null
      challenger_take_control: number | null
      challenger_total: number | null
      spiced_situation_score?: number | null
      spiced_pain_score?: number | null
      spiced_impact_score?: number | null
      spiced_critical_event_score?: number | null
      spiced_decision_score?: number | null
      spiced_delivery_score?: number | null
      spiced_weak_dimension?: string | null
      spiced_red_flags?: Json | null
      spiced_next_steps?: Json | null
      spiced_classification?: string | null
      spiced_coaching_rec?: string | null
      spin_situation_count?: number | null
      spin_problem_count?: number | null
      spin_implication_count?: number | null
      spin_need_payoff_count?: number | null
      spin_total_score?: number | null
      spin_sequence_analysis?: string | null
      spin_missed_questions?: Json | null
      spin_coaching_priority?: string | null
      challenger_teach_score?: number | null
      challenger_tailor_score?: number | null
      challenger_control_score?: number | null
      challenger_classification?: string | null
      challenger_red_flags?: Json | null
      challenger_coaching_rec?: string | null
      overall_quality?: string | null
      top_strength?: string | null
      top_gap?: string | null
      deal_risk?: string | null
      cross_framework_insight?: string | null
      priority_coaching?: string | null
      coordinator_override?: Json | null
      override_note?: string | null
    }>
    call_feedback: GenericTable<{
      id: string
      call_id: string
      author_email: string | null
      text: string
      type: string
      created_at: string
      coordinator_id?: string | null
      comment_text?: string | null
      transcript_position_s?: number | null
      feedback_type?: string | null
      transcript_excerpt?: string | null
      visible_to_closer?: boolean | null
    }>
    snippets: GenericTable<{
      id: string
      call_id: string | null
      created_at: string
      created_by: string | null
      text: string | null
      tag: string | null
      timestamp_s: number | null
      title?: string | null
      transcript_excerpt?: string | null
      start_second?: number | null
      end_second?: number | null
      is_public?: boolean | null
      is_featured?: boolean | null
      assigned_to?: string | null
      approved_at?: string | null
    }>
    snippet_assignments: GenericTable<{
      id: string
      created_at: string
      snippet_id: string
      assigned_to?: string | null
      assigned_to_email?: string | null
      assigned_by?: string | null
      assigned_by_email?: string | null
      note?: string | null
    }>
    snippet_views: GenericTable<{
      id: string
      created_at: string
      snippet_id: string
      user_id?: string | null
      viewed_by_email?: string | null
      watch_time_seconds?: number | null
      completed?: boolean | null
      viewed_at?: string | null
    }>
    user_roles: GenericTable
    profiles: GenericTable
  }
  Views: Record<string, GenericView> & {
    unified_calls: GenericView
    urgent_calls: GenericView
  }
  Functions: Record<string, { Args: Record<string, any>; Returns: any }>
  Enums: Record<string, never>
  CompositeTypes: Record<string, never>
}

export type Database = {
  __InternalSupabase: { PostgrestVersion: '12.2.3 (519615d)' }
  public: AppSchema
  GrowthPlatform: AppSchema
}

export type Call = Database['GrowthPlatform']['Tables']['calls']['Row']
export type CallAnalysis = Database['GrowthPlatform']['Tables']['call_analysis']['Row']
export type MethodologyScores = Database['GrowthPlatform']['Tables']['framework_scores']['Row']
export type CallFeedback = Database['GrowthPlatform']['Tables']['call_feedback']['Row']
export type Snippet = Database['GrowthPlatform']['Tables']['snippets']['Row']
export type SmartTracker = Database['GrowthPlatform']['Tables']['smart_trackers']['Row']
export type Role = 'executivo' | 'coordenador' | 'admin' | 'user'
export type TrackerCategory = string

export type SpicedJson = {
  scores?: Record<
    string,
    {
      justification?: string
      gaps?: string[]
      key_excerpt?: string | null
    }
  >
  coaching_recommendation?: {
    dimension_focus?: string
    recommendation?: string
    technique_suggested?: string
    example_question?: string
  }
  deal_next_steps?: string[]
  [key: string]: Json | undefined
}
export type SpinJson = {
  coaching_priority?: {
    weakest_category?: string
    recommendation?: string
    technique_suggested?: string
    example_question?: string
  }
  top_missed_questions?: string[]
  [key: string]: Json | undefined
}
export type ChallengerJson = { [key: string]: Json | undefined }
export type BehaviorSignalsJson = { [key: string]: Json | undefined }
export type ConsolidatedJson = { [key: string]: Json | undefined }
