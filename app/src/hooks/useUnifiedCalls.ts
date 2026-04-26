/**
 * useUnifiedCalls - hook que usa a view unificada para dados consistentes
 * Substitui useInsights para eliminar inconsistência entre pipelines
 */
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useRole } from '../contexts/RoleContext'
import type { Database } from '../types/database'

// Type para a view unificada (baseado em insights_calls_ae + campos enriquecidos)
export interface UnifiedCall {
  id: number
  vendedor: string | null
  lead: string | null
  perfil_do_lead: string | null
  data: string | null
  score_geral: number | null
  temperatura_identificada: string | null
  resumo: string | null
  principais_acertos: string | null
  pontos_de_melhoria: string | null
  proximos_passos: string | null
  abertura_e_alinhamento: string | null
  abertura_e_alinhamento_pp: number | null
  motivo_abertura_e_alinhamento: string | null
  situation: string | null
  situation_pp: number | null
  motivo_situation: string | null
  pain: string | null
  pain_pp: number | null
  motivo_pain: string | null
  impact: string | null
  impact_pp: number | null
  motivo_impact: string | null
  critical_event_emotion: string | null
  critical_event_emotion_pp: number | null
  motivo_critical_event_emotion: string | null
  delivery: string | null
  delivery_pp: number | null
  motivo_delivery: string | null
  conducao_fechamento: string | null
  conducao_fechamento_pp: number | null
  motivo_conducao_fechamento: string | null
  objecoes: string | null
  objecoes_pp: number | null
  motivo_objecoes: string | null
  deal_id: string | null
  meetingId: string | null
  nota_conversao: number | null
  call_name: string | null
  status_do_deal: string | null
  moderada: boolean | null
  segmento_lead: string | null
  produto_oferecido: string | null

  // Campos enriquecidos do webhook pipeline
  tldv_meeting_id: string | null
  tldv_url: string | null
  closer_email: string | null
  squad: string | null
  deal_stage: string | null
  deal_status: string | null
  deal_acv: number | null
  deal_lead_perfil: string | null
  lead_faixa: string | null
  deal_lead_segmento: string | null
  deal_produto: string | null
  utm_campaign: string | null
  origem_da_receita: string | null
  status: string | null
  happened_at: string | null
  duration_seconds: number | null
  processed_at: string | null

  // Análise do webhook pipeline
  webhook_summary: string | null
  client_pains: Array<{ text: string; timestamp_s?: number }> | null
  webhook_next_steps: Array<{ text: string }> | null
  critical_moments: Array<{ text: string; timestamp_s?: number; type?: string }> | null
  talk_ratio_seller: number | null
  talk_ratio_client: number | null
  longest_monologue_s: number | null
  questions_count: number | null
  competitors: Array<{ name: string; timestamp_s?: number; quote?: string }> | null
  webhook_objections: Array<{ text: string; timestamp_s?: number }> | null
  churn_signals: unknown[] | null
  buy_intent_signals: Array<{ text: string; timestamp_s?: number }> | null
  smart_trackers_detected: string[] | null

  // Scores do webhook pipeline
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

  // Metadata
  sort_date: string | null
  data_source: string
}

export interface UnifiedCallsOptions {
  limit?: number
  vendedor?: string | null
  daysAgo?: number | null
  dataSource?: 'insights_pipeline' | 'webhook_pipeline' | 'both'
}

export function useUnifiedCalls(opts: UnifiedCallsOptions = {}) {
  const { limit = 2000, vendedor = null, daysAgo = null, dataSource = 'both' } = opts
  const { viewedRole, simulatedCloser } = useRole()
  const [rows, setRows] = useState<UnifiedCall[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Build query with server-side filters
      let query = supabase
        .from('unified_calls')
        .select('*')
        .order('sort_date', { ascending: false })
        .limit(limit)

      // Apply data source filter
      if (dataSource !== 'both') {
        query = query.eq('data_source', dataSource)
      }

      // Apply period filter server-side
      if (daysAgo) {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - daysAgo)
        query = query.gte('sort_date', cutoffDate.toISOString())
      }

      // Apply role-based filtering
      if (viewedRole === 'executivo') {
        const email = simulatedCloser
        if (email) {
          // Filter by closer_email (more precise than name)
          query = query.eq('closer_email', email)
        }
      } else if (vendedor) {
        // Filter by vendedor name for coordinators
        query = query.ilike('vendedor', `%${vendedor}%`)
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        throw fetchError
      }

      setRows((data ?? []) as unknown as UnifiedCall[])
    } catch (err) {
      console.error('Error fetching unified calls:', err)
      setError(err instanceof Error ? err.message : 'Falha ao carregar calls unificadas')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [limit, vendedor, viewedRole, simulatedCloser, daysAgo, dataSource])

  return { rows, loading, error, retry: fetchData }
}

// Helper to get data source breakdown
export function useDataSourceStats() {
  const [stats, setStats] = useState<{ insights_pipeline: number; webhook_pipeline: number; total: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const { data, error } = await supabase
          
          .from('unified_calls')
          .select('data_source')

        if (!error && data) {
          const breakdown = (data as UnifiedCall[]).reduce((acc, call) => {
            acc[call.data_source as keyof typeof acc]++
            acc.total++
            return acc
          }, { insights_pipeline: 0, webhook_pipeline: 0, total: 0 })

          setStats(breakdown)
        }
      } catch (err) {
        console.error('Error fetching data source stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return { stats, loading }
}
