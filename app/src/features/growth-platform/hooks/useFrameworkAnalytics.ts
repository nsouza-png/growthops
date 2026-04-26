// ── useFrameworkAnalytics — Aggregated SPICED/SPIN/Challenger analytics ───────

import { useQuery } from '@tanstack/react-query'
import { GrowthPlatformAPI } from '../services/api'
import type { GrowthPlatformCall, GrowthPlatformProfile, GPFrameworkTotals } from '../types'

type Timeframe = '7d' | '30d' | '90d'

const TIMEFRAME_DAYS: Record<Timeframe, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

interface UseFrameworkAnalyticsOptions {
  profile: GrowthPlatformProfile | null
  timeframe?: Timeframe
  squadEmails?: string[]
  enabled?: boolean
}

interface FrameworkAnalyticsResult {
  calls: GrowthPlatformCall[]
  totals: GPFrameworkTotals
  spicedByDimension: {
    situation: number | null
    pain: number | null
    impact: number | null
    critical_event: number | null
    decision: number | null
    delivery: number | null
  }
  talkRatioAvg: number | null
  topWeakDimensions: string[]
  topStrengths: string[]
  dealRiskBreakdown: { baixo: number; medio: number; alto: number }
}

function avg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null)
  if (valid.length === 0) return null
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

function computeAnalytics(calls: GrowthPlatformCall[]): FrameworkAnalyticsResult {
  const scores = calls.map(c => c.framework_scores).filter(Boolean)
  const behaviors = calls.map(c => c.behavior_signals).filter(Boolean)

  const totals: GPFrameworkTotals = {
    spiced: avg(scores.map(s => s!.spiced_total)),
    spin: avg(scores.map(s => s!.spin_total_score)),
    challenger: avg(scores.map(s => s!.challenger_total)),
    behavior: avg(behaviors.map(b => b!.unified_score)),
    callCount: calls.length,
  }

  const spicedByDimension = {
    situation:      avg(scores.map(s => s!.spiced_situation_score)),
    pain:           avg(scores.map(s => s!.spiced_pain_score)),
    impact:         avg(scores.map(s => s!.spiced_impact_score)),
    critical_event: avg(scores.map(s => s!.spiced_critical_event_score)),
    decision:       avg(scores.map(s => s!.spiced_decision_score)),
    delivery:       avg(scores.map(s => s!.spiced_delivery_score)),
  }

  const talkRatioAvg = avg(behaviors.map(b => b!.talk_ratio_seller_pct))

  // Most frequent weak dimensions
  const weakDimCount: Record<string, number> = {}
  for (const s of scores) {
    if (s!.spiced_weak_dimension) {
      weakDimCount[s!.spiced_weak_dimension] = (weakDimCount[s!.spiced_weak_dimension] ?? 0) + 1
    }
  }
  const topWeakDimensions = Object.entries(weakDimCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([dim]) => dim)

  // Most frequent top strengths
  const strengthCount: Record<string, number> = {}
  for (const s of scores) {
    if (s!.top_strength) {
      strengthCount[s!.top_strength] = (strengthCount[s!.top_strength] ?? 0) + 1
    }
  }
  const topStrengths = Object.entries(strengthCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([str]) => str)

  // Deal risk breakdown
  const dealRiskBreakdown = { baixo: 0, medio: 0, alto: 0 }
  for (const s of scores) {
    const risk = s!.deal_risk?.toLowerCase()
    if (risk === 'baixo') dealRiskBreakdown.baixo++
    else if (risk === 'medio' || risk === 'médio') dealRiskBreakdown.medio++
    else if (risk === 'alto') dealRiskBreakdown.alto++
  }

  return {
    calls,
    totals,
    spicedByDimension,
    talkRatioAvg,
    topWeakDimensions,
    topStrengths,
    dealRiskBreakdown,
  }
}

export function useFrameworkAnalytics({
  profile,
  timeframe = '30d',
  squadEmails,
  enabled = true,
}: UseFrameworkAnalyticsOptions) {
  return useQuery<FrameworkAnalyticsResult>({
    queryKey: ['gp-framework-analytics', profile?.id, profile?.role, timeframe, squadEmails],
    queryFn: async () => {
      if (!profile) return computeAnalytics([])

      const days = TIMEFRAME_DAYS[timeframe]
      const sellerEmails =
        profile.role === 'executivo'
          ? [profile.email]
          : profile.role === 'coordenador' && squadEmails?.length
            ? squadEmails
            : undefined

      const calls = await GrowthPlatformAPI.getCallsSince(days, sellerEmails)
      return computeAnalytics(calls)
    },
    enabled: enabled && !!profile,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}
