// ── GrowthPlatformAPI — Service layer for GrowthPlatform schema ───────────────
// Queries public.gp_* views (migration 20260421000003) which proxy the
// GrowthPlatform schema tables. No Accept-Profile header needed.

import { gpSupabase } from '../../../lib/gpSupabase'
import type {
  GrowthPlatformProfile,
  GrowthPlatformCall,
  GrowthPlatformCallFollowup,
  GrowthPlatformCloserPDI,
  GrowthPlatformPipelineEvent,
  GPCallFilters,
  MarketIntelligenceWithRelations,
  CompetitorAnalysis,
  MarketTrend,
  WinLossAnalysis,
} from '../types'

// Shorthand: untyped client for gp_* views (public schema views don't appear
// in the generated Database type, so we cast once here instead of everywhere)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = gpSupabase as any

export class GrowthPlatformAPI {

  // ── Profiles ──────────────────────────────────────────────────────────────

  static async getProfileByAuthId(authUserId: string): Promise<GrowthPlatformProfile | null> {
    const { data, error } = await db
      
      .from('profiles')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single()

    if (error) {
      console.error('[GP] getProfileByAuthId error:', error.message)
      return null
    }
    return data as GrowthPlatformProfile
  }

  static async getProfileByEmail(email: string): Promise<GrowthPlatformProfile | null> {
    const { data, error } = await db
      
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single()

    if (error) {
      console.error('[GP] getProfileByEmail error:', error.message)
      return null
    }
    return data as GrowthPlatformProfile
  }

  static async getSquadProfiles(squad: string): Promise<GrowthPlatformProfile[]> {
    const { data, error } = await db
      
      .from('profiles')
      .select('*')
      .eq('squad', squad)
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('[GP] getSquadProfiles error:', error.message)
      return []
    }
    return (data ?? []) as GrowthPlatformProfile[]
  }

  static async getAllActiveProfiles(): Promise<GrowthPlatformProfile[]> {
    const { data, error } = await db
      
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('[GP] getAllActiveProfiles error:', error.message)
      return []
    }
    return (data ?? []) as GrowthPlatformProfile[]
  }

  // ── Calls ─────────────────────────────────────────────────────────────────
  // gp_calls is an enriched view: framework_scores, behavior_signals,
  // business_analysis and call_followups are already JSON-aggregated columns.

  static async getCalls(filters: GPCallFilters = {}): Promise<GrowthPlatformCall[]> {
    let query = db
      
      .from('calls')
      .select('*')
      .eq('processing_status', 'done')
      .order('call_date', { ascending: false })
      .limit(200)

    if (filters.seller) {
      query = query.eq('seller_email', filters.seller)
    }

    if (filters.sellerEmails && filters.sellerEmails.length > 0) {
      query = query.in('seller_email', filters.sellerEmails)
    }

    if (filters.dateRange) {
      query = query
        .gte('call_date', filters.dateRange[0])
        .lte('call_date', filters.dateRange[1])
    }

    if (filters.segment) {
      query = query.eq('segment', filters.segment)
    }

    const { data, error } = await query

    if (error) {
      console.error('[GP] getCalls error:', error.message)
      return []
    }
    return (data ?? []) as unknown as GrowthPlatformCall[]
  }

  static async getCallById(callId: string): Promise<GrowthPlatformCall | null> {
    const { data, error } = await db
      
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single()

    if (error) {
      console.error('[GP] getCallById error:', error.message)
      return null
    }
    return data as unknown as GrowthPlatformCall
  }

  // ── PDIs ──────────────────────────────────────────────────────────────────

  static async getPDIsBySellerEmail(email: string): Promise<GrowthPlatformCloserPDI[]> {
    const { data, error } = await db
      
      .from('closer_pdis')
      .select('*')
      .eq('seller_email', email)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[GP] getPDIsBySellerEmail error:', error.message)
      return []
    }
    return (data ?? []) as GrowthPlatformCloserPDI[]
  }

  static async getLatestPDI(email: string): Promise<GrowthPlatformCloserPDI | null> {
    const { data, error } = await db
      
      .from('closer_pdis')
      .select('*')
      .eq('seller_email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) return null
    return data as GrowthPlatformCloserPDI
  }

  // ── Call Followups ────────────────────────────────────────────────────────

  static async getCallFollowups(callId: string): Promise<GrowthPlatformCallFollowup[]> {
    const { data, error } = await db
      .rpc('get_gp_call_followups', { p_call_id: callId })

    if (error) {
      console.error('[GP] getCallFollowups error:', error.message)
      return []
    }
    return (data ?? []) as GrowthPlatformCallFollowup[]
  }

  static async generateWhatsAppFollowup(callId: string): Promise<{ message: string; tone: string; cta: string }> {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
    const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
    const { data: { session } } = await gpSupabase.auth.getSession()
    const token = session?.access_token ?? ANON_KEY

    const res = await fetch(`${SUPABASE_URL}/functions/v1/gp-generate-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ call_id: callId }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? `HTTP ${res.status}`)
    }
    return res.json()
  }

  static async generatePDI(callId: string, period?: string): Promise<{ pdi: GrowthPlatformCloserPDI['pdi_content'] }> {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
    const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
    const { data: { session } } = await gpSupabase.auth.getSession()
    const token = session?.access_token ?? ANON_KEY

    const res = await fetch(`${SUPABASE_URL}/functions/v1/gp-generate-pdi`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ call_id: callId, period }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? `HTTP ${res.status}`)
    }
    return res.json()
  }

  // ── Pipeline Events ───────────────────────────────────────────────────────

  static async getPipelineEvents(callId?: string): Promise<GrowthPlatformPipelineEvent[]> {
    let query = db
      
      .from('pipeline_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (callId) {
      query = query.eq('call_id', callId)
    }

    const { data, error } = await query
    if (error) {
      console.error('[GP] getPipelineEvents error:', error.message)
      return []
    }
    return (data ?? []) as GrowthPlatformPipelineEvent[]
  }

  // ── Analytics helpers ─────────────────────────────────────────────────────

  static async getCallsSince(daysAgo: number, sellerEmails?: string[]): Promise<GrowthPlatformCall[]> {
    const since = new Date()
    since.setDate(since.getDate() - daysAgo)

    return GrowthPlatformAPI.getCalls({
      dateRange: [since.toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)],
      sellerEmails,
    })
  }

  // ── Market Intelligence ─────────────────────────────────────────────────────

  static async getMarketIntelligence(): Promise<MarketIntelligenceWithRelations | null> {
    const { data, error } = await db
      
      .from('gp_market_intelligence')
      .select(`
        *,
        competitor_analyses (
          id,
          competitor_name,
          website,
          funding_stage,
          team_size,
          key_features,
          strengths,
          weaknesses,
          market_position,
          threat_level,
          created_at
        ),
        market_trends (
          id,
          trend_name,
          category,
          description,
          impact_level,
          time_horizon,
          data_sources,
          created_at
        ),
        win_loss_analyses (
          id,
          deal_id,
          competitor_name,
          outcome,
          reason_category,
          specific_reason,
          lessons_learned,
          created_at
        )
      `)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[GP] getMarketIntelligence error:', error.message)
      return null
    }
    return data as MarketIntelligenceWithRelations
  }

  static async createCompetitorAnalysis(analysis: Omit<CompetitorAnalysis, 'id' | 'created_at' | 'market_intelligence_id'>): Promise<CompetitorAnalysis> {
    const { data: marketData } = await db
      
      .from('gp_market_intelligence')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!marketData) {
      throw new Error('Nenhuma inteligência de mercado encontrada para associar análise')
    }

    const { data, error } = await db
      
      .from('gp_competitor_analyses')
      .insert({
        ...analysis,
        market_intelligence_id: marketData.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('[GP] createCompetitorAnalysis error:', error.message)
      throw new Error(`Falha ao criar análise competitiva: ${error.message}`)
    }

    return data as CompetitorAnalysis
  }

  static async createMarketTrend(trend: Omit<MarketTrend, 'id' | 'created_at' | 'market_intelligence_id'>): Promise<MarketTrend> {
    const { data: marketData } = await db
      
      .from('gp_market_intelligence')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!marketData) {
      throw new Error('Nenhuma inteligência de mercado encontrada para associar tendência')
    }

    const { data, error } = await db
      
      .from('gp_market_trends')
      .insert({
        ...trend,
        market_intelligence_id: marketData.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('[GP] createMarketTrend error:', error.message)
      throw new Error(`Falha ao criar tendência de mercado: ${error.message}`)
    }

    return data as MarketTrend
  }

  static async createWinLossAnalysis(analysis: Omit<WinLossAnalysis, 'id' | 'created_at' | 'market_intelligence_id'>): Promise<WinLossAnalysis> {
    const { data: marketData } = await db
      
      .from('gp_market_intelligence')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!marketData) {
      throw new Error('Nenhuma inteligência de mercado encontrada para associar análise Win/Loss')
    }

    const { data, error } = await db
      
      .from('gp_win_loss_analyses')
      .insert({
        ...analysis,
        market_intelligence_id: marketData.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('[GP] createWinLossAnalysis error:', error.message)
      throw new Error(`Falha ao criar análise Win/Loss: ${error.message}`)
    }

    return data as WinLossAnalysis
  }
}
