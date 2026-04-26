import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Call } from '../../../types/database'

// ---------------------------------------------------------------------------
// DealContext — contrato tipado para exibição no painel de contexto do deal
// ---------------------------------------------------------------------------

export interface DealContext {
  dealId: string
  leadPerfil: string | null       // lead_perfil from calls table
  leadSegmento: string | null     // lead_segmento
  leadFaixa: string | null        // lead_faixa
  dealAcv: number | null          // deal_acv
  produtoOferecido: string | null // produto_oferecido
  dealStage: string | null        // deal_stage
  closerEmail: string | null      // closer_email
  // Scores históricos do último call analisado neste deal
  historicalSpiced: {
    total: number | null
    situation: number | null
    pain: number | null
    impact: number | null
    criticalEvent: number | null
    decision: number | null
  } | null
}

// ---------------------------------------------------------------------------
// Row shape retornado pelo Supabase
// ---------------------------------------------------------------------------

interface FrameworkScoresRow {
  call_id: string
  spiced_total: number | null
  spiced_situation: number | null
  spiced_pain: number | null
  spiced_impact: number | null
  spiced_critical_event: number | null
  spiced_decision: number | null
}

interface CallRow extends Call {}
interface CallRowWithLegacyScores extends CallRow {
  scores?: FrameworkScoresRow | null
}

// ---------------------------------------------------------------------------
// useDealContext
// ---------------------------------------------------------------------------

export function useDealContext(dealId: string | undefined): {
  context: DealContext | null
  loading: boolean
  error: string | null
} {
  const [context, setContext] = useState<DealContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Segurança: não disparar query com dealId inválido (T-04-01-02)
    if (!dealId || dealId.trim() === '') {
      setContext(null)
      setLoading(false)
      setError(null)
      return
    }

    // narrowedDealId: TypeScript narrowing — at this point dealId is guaranteed string
    const narrowedDealId: string = dealId

    let cancelled = false

    async function fetch() {
      setLoading(true)
      setError(null)

      const { data, error: err } = await supabase
        .from('calls')
        .select('*')
        .eq('deal_id', narrowedDealId)
        .not('happened_at', 'is', null)
        .order('call_date', { ascending: false })
        .limit(1)

      if (cancelled) return

      if (err) {
        setError(err.message)
        setContext(null)
        setLoading(false)
        return
      }

      const rows = (data ?? []) as unknown as CallRowWithLegacyScores[]
      const row = rows[0] ?? null

      if (!row) {
        setContext(null)
        setLoading(false)
        return
      }

      // Buscar scores do último call encontrado
      let scores: FrameworkScoresRow | null = row.scores ?? null
      // When legacy nested `scores` exists (even null), trust it to avoid duplicate query.
      if (row.scores === undefined) {
        const { data: scoresData } = await supabase
          .from('framework_scores')
          .select('call_id, spiced_total, spiced_situation, spiced_pain, spiced_impact, spiced_critical_event, spiced_decision')
          .eq('call_id', row.id)
          .limit(1)

        if (!cancelled && scoresData && scoresData.length > 0) {
          scores = scoresData[0] as FrameworkScoresRow
        }
      }

      if (cancelled) return

      setContext({
        dealId: row.deal_id ?? narrowedDealId,
        leadPerfil: row.lead_perfil,
        leadSegmento: row.lead_segmento,
        leadFaixa: row.lead_faixa,
        dealAcv: row.deal_acv,
        produtoOferecido: row.produto_oferecido,
        dealStage: row.deal_stage,
        closerEmail: row.closer_email,
        historicalSpiced: scores
          ? {
            total: scores.spiced_total,
            situation: scores.spiced_situation,
            pain: scores.spiced_pain,
            impact: scores.spiced_impact,
            criticalEvent: scores.spiced_critical_event,
            decision: scores.spiced_decision,
          }
          : null,
      })

      setLoading(false)
    }

    fetch()

    return () => {
      cancelled = true
    }
  }, [dealId])

  return { context, loading, error }
}
