/**
 * useSmartAlerts - Sistema de Alertas Inteligentes Avançado
 * Detecta padrões, prevê riscos e sugere ações proativas
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useRole } from '../contexts/RoleContext'
import type { InsightRow } from '../types/insights'

export interface SmartAlert {
  id: string
  type: 'performance_decline' | 'churn_risk' | 'coaching_opportunity' | 'methodology_gap' | 'achievement'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  recommendation: string
  metadata: {
    userId?: string
    scores?: number[]
    trend?: 'up' | 'down' | 'stable'
    methodology?: string
    timeframe?: string
    impact_score?: number
  }
  created_at: string
  acknowledged: boolean
  actions_taken?: string[]
}

export interface AlertPattern {
  pattern: string
  description: string
  trigger: (data: any[]) => boolean
  recommendation: string
  severity: SmartAlert['severity']
}

// Padrões de alerta inteligentes
const ALERT_PATTERNS: AlertPattern[] = [
  {
    pattern: 'performance_decline',
    description: 'Queda consecutiva de performance',
    trigger: (scores: number[]) => {
      if (scores.length < 3) return false
      const recent = scores.slice(-3)
      return recent.every((score, i) => i > 0 && score < recent[i - 1] - 5)
    },
    recommendation: 'Agendar sessão de coaching imediata. Analisar mudanças recentes e fornecer suporte personalizado.',
    severity: 'high'
  },
  {
    pattern: 'churn_risk',
    description: 'Score abaixo de 40 em 3+ calls',
    trigger: (scores: number[]) => {
      return scores.filter(s => s < 40).length >= 3
    },
    recommendation: 'Intervenção urgente. Revisar treinamento, considerar acompanhamento intensivo.',
    severity: 'critical'
  },
  {
    pattern: 'methodology_gap',
    description: 'Dificuldade específica em metodologia',
    trigger: (data: any[]) => {
      const methodologyScores = data.map(d => d.spiced_total).filter(s => s != null)
      return methodologyScores.some(s => s < 5)
    },
    recommendation: 'Foco em treinamento específico da metodologia. Usar exemplos práticos e role-play.',
    severity: 'medium'
  },
  {
    pattern: 'achievement',
    description: 'Milestone positivo alcançado',
    trigger: (scores: number[]) => {
      if (scores.length < 5) return false
      const recent = scores.slice(-5)
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length
      return avg >= 8.5
    },
    recommendation: 'Celebrar achievement! Compartilhar como best practice com a equipe.',
    severity: 'low'
  }
]

export function useSmartAlerts() {
  const [alerts, setAlerts] = useState<SmartAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [patterns, setPatterns] = useState<AlertPattern[]>(ALERT_PATTERNS)
  const { viewedRole, simulatedCloser } = useRole()

  // Analisar dados e gerar alertas
  const analyzeData = useCallback(async (insights: InsightRow[]) => {
    const newAlerts: SmartAlert[] = []

    // Agrupar dados por vendedor
    const sellerData = new Map<string, InsightRow[]>()
    insights.forEach(insight => {
      if (insight.vendedor) {
        const current = sellerData.get(insight.vendedor) || []
        current.push(insight)
        sellerData.set(insight.vendedor, current)
      }
    })

    // Analisar cada vendedor
    for (const [seller, sellerInsights] of sellerData) {
      const scores = sellerInsights
        .map(i => i.score_geral)
        .filter((s): s is number => s != null)
        .sort((a, b) => a - b)

      // Verificar padrões
      patterns.forEach(pattern => {
        if (pattern.trigger(scores)) {
          const alert: SmartAlert = {
            id: `${pattern.pattern}-${seller}-${Date.now()}`,
            type: pattern.pattern as SmartAlert['type'],
            severity: pattern.severity,
            title: `${pattern.description} - ${seller}`,
            description: generateDescription(pattern.pattern, scores, seller),
            recommendation: pattern.recommendation,
            metadata: {
              userId: seller,
              scores,
              trend: calculateTrend(scores),
              timeframe: getLastDays(scores.length),
              impact_score: calculateImpactScore(scores)
            },
            created_at: new Date().toISOString(),
            acknowledged: false
          }
          newAlerts.push(alert)
        }
      })
    }

    return newAlerts
  }, [patterns])

  // Gerar descrição baseada no padrão
  const generateDescription = (pattern: string, scores: number[], seller: string): string => {
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
    const recentScore = scores[scores.length - 1]

    switch (pattern) {
      case 'performance_decline':
        return `${seller} teve queda de performance. Score atual: ${recentScore}, média: ${avgScore.toFixed(1)}`
      case 'churn_risk':
        return `${seller} em risco de churn. ${scores.filter(s => s < 40).length} calls com score < 40`
      case 'methodology_gap':
        return `${seller} com dificuldade em metodologias específicas. Score médio: ${avgScore.toFixed(1)}`
      case 'achievement':
        return `${seller} alcançou excelente performance! Score médio: ${avgScore.toFixed(1)}`
      default:
        return `Alerta para ${seller} - Score médio: ${avgScore.toFixed(1)}`
    }
  }

  // Calcular tendência
  const calculateTrend = (scores: number[]): 'up' | 'down' | 'stable' => {
    if (scores.length < 2) return 'stable'

    const recent = scores.slice(-3)
    const older = scores.slice(-6, -3)

    if (older.length === 0) return 'stable'

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length

    if (recentAvg > olderAvg + 2) return 'up'
    if (recentAvg < olderAvg - 2) return 'down'
    return 'stable'
  }

  // Calcular timeframe
  const getLastDays = (count: number): string => {
    return `Últimos ${count} dias`
  }

  // Calcular score de impacto
  const calculateImpactScore = (scores: number[]): number => {
    if (scores.length === 0) return 0

    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    const variance = scores.reduce((acc, score) => acc + Math.pow(score - avg, 2), 0) / scores.length

    // Impacto baseado na média e consistência
    const consistency = 1 - (variance / 100) // Menor variância = mais consistente
    return (avg / 10) * consistency
  }

  // Buscar insights e analisar
  const fetchAndAnalyze = useCallback(async () => {
    try {
      setLoading(true)

      let query = supabase

        .from('unified_calls')
        .select('*')
        .order('sort_date', { ascending: false })
        .limit(1000) // Últimas 1000 calls

      // Aplicar filtros baseados no papel
      if (viewedRole === 'executivo' && simulatedCloser) {
        query = query.eq('closer_email', simulatedCloser)
      }

      const { data: rawInsights, error } = await query

      if (error) throw error

      // Backfill score_geral e created_at para compatibilidade com InsightRow
      const insights = (rawInsights || []).map(r => ({
        ...r,
        score_geral: r.score_geral ?? (r.spiced_total != null ? r.spiced_total * 10 : null),
        created_at: r.created_at ?? r.sort_date,
      }))

      const newAlerts = await analyzeData(insights as unknown as InsightRow[])

      // Mesclar com alertas existentes não reconhecidos
      setAlerts(prev => {
        const existing = prev.filter(a => !a.acknowledged)
        const merged = [...existing, ...newAlerts]

        // Remover duplicados e ordenar por severidade
        const unique = merged.filter((alert, index, self) =>
          index === self.findIndex(a => a.id === alert.id)
        )

        return unique.sort((a, b) => {
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
          return severityOrder[b.severity] - severityOrder[a.severity]
        })
      })
    } catch (error) {
      console.error('Error analyzing alerts:', error)
    } finally {
      setLoading(false)
    }
  }, [viewedRole, simulatedCloser, analyzeData])

  // Reconhecer alerta
  const acknowledgeAlert = useCallback(async (alertId: string) => {
    setAlerts(prev => prev.map(alert =>
      alert.id === alertId
        ? { ...alert, acknowledged: true, actions_taken: [...(alert.actions_taken || []), 'acknowledged'] }
        : alert
    ))
  }, [])

  // Adicionar ação ao alerta
  const addActionToAlert = useCallback(async (alertId: string, action: string) => {
    setAlerts(prev => prev.map(alert =>
      alert.id === alertId
        ? { ...alert, actions_taken: [...(alert.actions_taken || []), action] }
        : alert
    ))
  }, [])

  // Buscar alertas salvos do banco
  const loadSavedAlerts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        
        .from('smart_alerts')
        .select('*')
        .eq('acknowledged', false)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error

      setAlerts((data || []) as unknown as SmartAlert[])
    } catch (error) {
      console.error('Error loading saved alerts:', error)
    }
  }, [])

  // Salvar alerta no banco
  const saveAlert = useCallback(async (alert: SmartAlert) => {
    try {
      const { error } = await supabase
        
        .from('smart_alerts')
        .insert({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          recommendation: alert.recommendation,
          metadata: alert.metadata,
          acknowledged: alert.acknowledged,
          actions_taken: alert.actions_taken
        })

      if (error) throw error
    } catch (error) {
      console.error('Error saving alert:', error)
    }
  }, [])

  // Efeito inicial
  useEffect(() => {
    loadSavedAlerts()
    fetchAndAnalyze()

    // Analisar a cada 10 minutos
    const interval = setInterval(fetchAndAnalyze, 10 * 60 * 1000)

    return () => clearInterval(interval)
  }, [fetchAndAnalyze, loadSavedAlerts])

  // Salvar novos alertas automaticamente
  useEffect(() => {
    alerts.forEach(alert => {
      if (!alert.acknowledged) {
        saveAlert(alert)
      }
    })
  }, [alerts, saveAlert])

  // Alertas não reconhecidos por severidade
  const unacknowledgedBySeverity = useMemo(() => {
    const unacknowledged = alerts.filter(a => !a.acknowledged)
    return {
      critical: unacknowledged.filter(a => a.severity === 'critical'),
      high: unacknowledged.filter(a => a.severity === 'high'),
      medium: unacknowledged.filter(a => a.severity === 'medium'),
      low: unacknowledged.filter(a => a.severity === 'low'),
    }
  }, [alerts])

  return {
    alerts,
    loading,
    unacknowledgedBySeverity,
    acknowledgeAlert,
    addActionToAlert,
    refresh: fetchAndAnalyze,
    totalUnacknowledged: alerts.filter(a => !a.acknowledged).length
  }
}
