// ── useMarketIntelligence — Hook para dados de inteligência de mercado ──────────
import { useEffect, useState } from 'react'
import { gpSupabase } from '../../../lib/gpSupabase'
import type {
  MarketIntelligenceWithRelations,
  CompetitorAnalysis,
  MarketTrend,
  WinLossAnalysis
} from '../types'

export function useMarketIntelligence() {
  const [data, setData] = useState<MarketIntelligenceWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadMarketIntelligence() {
      setLoading(true)
      setError(null)

      try {
        // Buscar inteligência de mercado mais recente
        const { data: marketData, error: marketError } = await gpSupabase
          
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

        if (marketError) {
          console.error('[MarketIntelligence] Erro ao carregar dados:', marketError.message)
          setError('Falha ao carregar inteligência de mercado')
          return
        }

        setData(marketData as unknown as MarketIntelligenceWithRelations)
      } catch (err) {
        console.error('[MarketIntelligence] Erro inesperado:', err)
        setError('Erro ao carregar dados de mercado')
      } finally {
        setLoading(false)
      }
    }

    loadMarketIntelligence()
  }, [])

  async function refreshData() {
    // Força recarga dos dados
    const { data: marketData, error } = await gpSupabase
      
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

    if (!error && marketData) {
      setData(marketData as unknown as MarketIntelligenceWithRelations)
    }
  }

  return {
    data,
    loading,
    error,
    refreshData
  }
}
