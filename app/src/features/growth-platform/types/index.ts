// ── GrowthPlatform — Business-level TypeScript interfaces ────────────────────
// These are the domain types used across components, hooks, and services.
// DB row types live in ./database.ts — these add computed/joined fields.

export type GPRole = 'executivo' | 'coordenador' | 'gerente' | 'diretor' | 'sales_ops' | 'admin'
export type GPProcessingStatus = 'pending' | 'processing' | 'done' | 'error'
export type GPFollowupChannel = 'whatsapp' | 'email'
export type GPDealRisk = 'baixo' | 'medio' | 'alto'
export type GPScoreBand = 'excelente' | 'bom' | 'regular' | 'fraco'

// ── Market Intelligence ─────────────────────────────────────────────────────

export interface MarketIntelligence {
  id: string
  created_at: string
  updated_at: string
}

export interface CompetitorAnalysis {
  id: string
  market_intelligence_id: string
  competitor_name: string
  website: string | null
  funding_stage: string | null
  team_size: number | null
  key_features: string[]
  strengths: string[]
  weaknesses: string[]
  market_position: 'líder' | 'desafiante' | 'niche' | 'entrada'
  threat_level: 'baixo' | 'médio' | 'alto'
  created_at: string
}

export interface MarketTrend {
  id: string
  market_intelligence_id: string
  trend_name: string
  category: 'tecnologia' | 'comportamento' | 'mercado' | 'regulatório'
  description: string
  impact_level: 'baixo' | 'médio' | 'alto'
  time_horizon: 'curto' | 'médio' | 'longo'
  data_sources: string[]
  created_at: string
}

export interface WinLossAnalysis {
  id: string
  market_intelligence_id: string
  deal_id: string | null
  competitor_name: string
  outcome: 'win' | 'loss'
  reason_category: 'preço' | 'produto' | 'relacionamento' | 'timing' | 'outro'
  specific_reason: string
  lessons_learned: string[]
  created_at: string
}

export interface MarketIntelligenceWithRelations extends MarketIntelligence {
  competitor_analyses?: CompetitorAnalysis[]
  market_trends?: MarketTrend[]
  win_loss_analyses?: WinLossAnalysis[]
}

// ── Profile ───────────────────────────────────────────────────────────────────

export interface GrowthPlatformProfile {
  id: string
  email: string
  name: string
  cargo: string
  role: GPRole
  squad: string | null
  setor: string | null
  lider_direto: string | null
  data_entrada: string | null
  is_active: boolean
  auth_user_id: string | null
  created_at: string
  updated_at: string
}

// ── Call ──────────────────────────────────────────────────────────────────────

export interface GrowthPlatformCall {
  id: string
  tldv_call_id: string | null
  seller_email: string
  seller_name: string
  prospect_name: string | null
  prospect_company: string | null
  segment: string | null
  call_date: string | null
  duration_min: number | null
  data_source: string | null
  word_count: number | null
  transcript_quality: string | null
  transcript_text: string | null
  processing_status: GPProcessingStatus
  created_at: string
  updated_at: string
  // Joined relations (when queried with select *)
  framework_scores?: GrowthPlatformFrameworkScores | null
  behavior_signals?: GrowthPlatformBehaviorSignals | null
  business_analysis?: GrowthPlatformBusinessAnalysis | null
  call_followups?: GrowthPlatformCallFollowup[] | null
}

// ── Framework Scores ──────────────────────────────────────────────────────────

export interface GrowthPlatformFrameworkScores {
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
  spiced_red_flags: string[] | null
  spiced_highlights: string[] | null
  spiced_coaching_rec: string | null
  spiced_next_steps: string | null
  // SPIN
  spin_situation_count: number | null
  spin_problem_count: number | null
  spin_implication_count: number | null
  spin_need_payoff_count: number | null
  spin_sequence_analysis: string | null
  spin_total_score: number | null
  spin_missed_questions: string[] | null
  spin_coaching_priority: string | null
  // Challenger
  challenger_teach_score: number | null
  challenger_tailor_score: number | null
  challenger_control_score: number | null
  challenger_total: number | null
  challenger_classification: string | null
  challenger_red_flags: string[] | null
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

// ── Behavior Signals ──────────────────────────────────────────────────────────

export interface GPBehaviorSignal {
  signal: string
  framework: string
  dimension: string
  polarity: 'positive' | 'negative' | 'neutral'
  intensity: 1 | 2 | 3
  excerpt: string
}

export interface GrowthPlatformBehaviorSignals {
  id: string
  call_id: string
  talk_ratio_seller_pct: number | null
  peeling_depth_levels: number | null
  transitions_detected: number | null
  name_usage_count: number | null
  seller_profile: string | null
  top_signals: GPBehaviorSignal[] | null
  unified_score: number | null
  unified_score_max: number | null
  unified_score_band: string | null
  created_at: string
}

// ── Business Analysis ─────────────────────────────────────────────────────────

export interface GPNextAction {
  action: string
  owner: string
  deadline: string
  channel: string
}

export interface GrowthPlatformBusinessAnalysis {
  id: string
  call_id: string
  deal_stage: string | null
  estimated_arr: number | null
  budget_mentioned: boolean | null
  timeline_urgency: string | null
  stakeholders: unknown[] | null
  pain_business_case: string | null
  roi_signals: unknown[] | null
  next_action: GPNextAction | null
  raw_json: Record<string, unknown> | null
  created_at: string
}

// ── Call Followup ─────────────────────────────────────────────────────────────

export interface GrowthPlatformCallFollowup {
  id: string
  call_id: string
  channel: GPFollowupChannel
  content: string
  generated_by: string | null
  sent_at: string | null
  created_at: string
}

// ── Closer PDI ────────────────────────────────────────────────────────────────

export interface GPPDIPriority {
  area: string
  current_level: string
  target_level: string
  exercises: string[]
  timeline_weeks: number
}

export interface GPPDIKPITargets {
  talk_ratio_target: number
  spiced_target_pct: number
  unified_behavior_target: number
}

export interface GPPDIContent {
  summary?: string
  priorities: GPPDIPriority[] | string[]
  exercises?: string[]
  timeline?: string
  focus_areas?: string[]
  quick_wins?: string[]
  kpi_targets?: GPPDIKPITargets
  coaching_cadence?: string
}

export interface GrowthPlatformCloserPDI {
  id: string
  call_id: string
  seller_email: string
  pdi_content: GPPDIContent
  period: string | null
  generated_by: string | null
  created_at: string
}

// ── Pipeline Event ────────────────────────────────────────────────────────────

export interface GrowthPlatformPipelineEvent {
  id: string
  call_id: string | null
  step: string
  status: 'started' | 'success' | 'error'
  payload: Record<string, unknown> | null
  error_msg: string | null
  duration_ms: number | null
  created_at: string
}

// ── Filter types ──────────────────────────────────────────────────────────────

export interface GPCallFilters {
  dateRange?: [string, string]    // ISO date strings
  seller?: string                 // seller_email
  sellerEmails?: string[]         // multiple sellers (squad view)
  segment?: string
  processingStatus?: GPProcessingStatus
  dealRisk?: string
}

export interface GPTimeframe {
  label: string
  days: number
  value: '7d' | '30d' | '90d' | 'custom'
}

// ── Analytics aggregates ──────────────────────────────────────────────────────

export interface GPSquadMemberStats {
  profile: GrowthPlatformProfile
  callCount: number
  avgSpicedScore: number | null
  avgTalkRatio: number | null
  lastCallDate: string | null
  needsCoaching: boolean
  trend: 'up' | 'down' | 'stable'
}

export interface GPFrameworkTotals {
  spiced: number | null
  spin: number | null
  challenger: number | null
  behavior: number | null
  callCount: number
}

// ── Role capabilities ─────────────────────────────────────────────────────────

export const GP_ROLE_LABELS: Record<GPRole, string> = {
  executivo:    'Executivo de Vendas',
  coordenador:  'Coordenador',
  gerente:      'Gerente',
  diretor:      'Diretor',
  sales_ops:    'Sales Operations',
  admin:        'Admin',
}

export function gpCanViewSquad(role: GPRole): boolean {
  return ['coordenador', 'gerente', 'diretor', 'sales_ops', 'admin'].includes(role)
}

export function gpCanViewAll(role: GPRole): boolean {
  return ['gerente', 'diretor', 'sales_ops', 'admin'].includes(role)
}

export function gpCanManage(role: GPRole): boolean {
  return ['sales_ops', 'admin'].includes(role)
}
