/**
 * useRealtimeMetrics - hook para métricas em tempo real com WebSocket
 * Implementa updates automáticos de dashboard e alertas
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useRole } from '../contexts/RoleContext'

export interface RealtimeMetrics {
  totalCalls: number
  avgScore: number
  activeClosers: number
  callsToday: number
  criticalCalls: number
  topPerformer: {
    name: string
    score: number
    callsCount: number
  } | null
  alerts: {
    type: 'critical_call' | 'high_score' | 'new_feedback'
    message: string
    timestamp: string
    metadata?: any
  }[]
  lastUpdated: string
}

export function useRealtimeMetrics() {
  const [metrics, setMetrics] = useState<RealtimeMetrics>({
    totalCalls: 0,
    avgScore: 0,
    activeClosers: 0,
    callsToday: 0,
    criticalCalls: 0,
    topPerformer: null,
    alerts: [],
    lastUpdated: new Date().toISOString()
  })
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { viewedRole, simulatedCloser } = useRole()

  const subscriptionRef = useRef<any>(null)
  const metricsChannelRef = useRef<any>(null)

  // Fetch initial metrics
  const fetchMetrics = useCallback(async () => {
    try {
      setError(null)

      // Get today's date in Brazilian timezone
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString()

      // Build role-based query
      let query = supabase

        .from('unified_calls')
        .select('vendedor, spiced_total, sort_date, closer_email')

      if (viewedRole === 'executivo' && simulatedCloser) {
        query = query.eq('closer_email', simulatedCloser)
      }

      const { data: insights, error: insightsError } = await query

      if (insightsError) throw insightsError

      const totalCalls = insights?.length || 0
      const scores = insights?.map(r => r.spiced_total != null ? r.spiced_total * 10 : null).filter((s): s is number => s != null) || []
      const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
      const criticalCalls = scores.filter(s => s < 50).length
      const callsToday = insights?.filter(r => r.sort_date && new Date(r.sort_date) >= today).length || 0

      // Calculate top performer
      const performerMap = new Map<string, { scores: number[]; count: number }>()
      insights?.forEach(r => {
        if (r.vendedor && r.spiced_total != null) {
          const current = performerMap.get(r.vendedor) || { scores: [], count: 0 }
          current.scores.push(r.spiced_total * 10)
          current.count++
          performerMap.set(r.vendedor, current)
        }
      })

      let topPerformer: RealtimeMetrics['topPerformer'] = null
      let bestAvg = 0
      performerMap.forEach((data, name) => {
        const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length
        if (avg > bestAvg) {
          bestAvg = avg
          topPerformer = { name, score: Math.round(avg), callsCount: data.count }
        }
      })

      const activeClosers = performerMap.size

      // Get recent alerts
      const alerts = await generateAlerts(insights || [])

      setMetrics(prev => ({
        ...prev,
        totalCalls,
        avgScore: Math.round(avgScore),
        activeClosers,
        callsToday,
        criticalCalls,
        topPerformer,
        alerts: alerts.slice(0, 5), // Keep only 5 most recent
        lastUpdated: new Date().toISOString()
      }))
    } catch (err) {
      console.error('Error fetching metrics:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar métricas')
    }
  }, [viewedRole, simulatedCloser])

  // Generate alerts based on data
  const generateAlerts = async (insights: any[]) => {
    const alerts: RealtimeMetrics['alerts'] = []
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    // Check for critical calls in last hour
    const recentCritical = insights.filter(r =>
      r.spiced_total != null &&
      r.spiced_total * 10 < 50 &&
      r.sort_date &&
      new Date(r.sort_date) >= oneHourAgo
    )

    if (recentCritical.length > 0) {
      alerts.push({
        type: 'critical_call',
        message: `${recentCritical.length} chamada(s) crítica(s) na última hora`,
        timestamp: new Date().toISOString(),
        metadata: { calls: recentCritical.length }
      })
    }

    // Check for high scores
    const recentHigh = insights.filter(r =>
      r.spiced_total != null &&
      r.spiced_total >= 9 &&
      r.sort_date &&
      new Date(r.sort_date) >= oneHourAgo
    )

    if (recentHigh.length > 0) {
      alerts.push({
        type: 'high_score',
        message: `${recentHigh.length} chamada(s) com score >= 9`,
        timestamp: new Date().toISOString(),
        metadata: { calls: recentHigh.length }
      })
    }

    // Check for new feedback
    const { data: recentFeedback } = await supabase
      
      .from('call_feedback')
      .select('id, created_at')
      .gte('created_at', oneHourAgo.toISOString())
      .limit(1)

    if (recentFeedback && recentFeedback.length > 0) {
      alerts.push({
        type: 'new_feedback',
        message: 'Novo feedback adicionado',
        timestamp: new Date().toISOString(),
        metadata: { feedbackCount: recentFeedback.length }
      })
    }

    return alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  // Setup real-time subscription
  useEffect(() => {
    const setupSubscription = async () => {
      try {
        // Subscribe to changes in calls
        const channel = supabase
          .channel('realtime-metrics')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'calls'
            },
            () => {
              // Refetch metrics when data changes
              fetchMetrics()
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'gp_call_feedback'
            },
            () => {
              // Refetch metrics when feedback changes
              fetchMetrics()
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              setIsConnected(true)
            } else if (status === 'CHANNEL_ERROR') {
              setIsConnected(false)
              setError('Erro na conexão real-time')
            }
          })

        subscriptionRef.current = channel
        metricsChannelRef.current = channel
      } catch (err) {
        console.error('Error setting up subscription:', err)
        setError('Falha ao configurar atualizações em tempo real')
        setIsConnected(false)
      }
    }

    setupSubscription()

    // Initial fetch
    fetchMetrics()

    // Refresh metrics every 30 seconds as fallback
    const interval = setInterval(fetchMetrics, 30000)

    return () => {
      clearInterval(interval)
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
      }
    }
  }, [fetchMetrics])

  // Manual refresh
  const refresh = useCallback(() => {
    fetchMetrics()
  }, [fetchMetrics])

  return {
    metrics,
    isConnected,
    error,
    refresh
  }
}
