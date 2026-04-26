// ── useSquadAnalytics — Squad performance metrics for coordenadores ───────────

import { useQuery } from '@tanstack/react-query'
import { GrowthPlatformAPI } from '../services/api'
import type {
  GrowthPlatformProfile,
  GrowthPlatformCall,
  GPSquadMemberStats,
} from '../types'

interface UseSquadAnalyticsOptions {
  profile: GrowthPlatformProfile | null
  enabled?: boolean
}

interface SquadAnalyticsResult {
  members: GrowthPlatformProfile[]
  memberStats: GPSquadMemberStats[]
  squadEmailList: string[]
  topPerformer: GrowthPlatformProfile | null
  needsCoachingList: GrowthPlatformProfile[]
}

function buildMemberStats(
  members: GrowthPlatformProfile[],
  calls: GrowthPlatformCall[],
): GPSquadMemberStats[] {
  return members.map(member => {
    const memberCalls = calls.filter(c => c.seller_email === member.email)
    const scores = memberCalls
      .map(c => c.framework_scores?.spiced_total)
      .filter((v): v is number => v !== null)

    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null

    const talkRatios = memberCalls
      .map(c => c.behavior_signals?.talk_ratio_seller_pct)
      .filter((v): v is number => v !== null)

    const avgTalkRatio = talkRatios.length > 0
      ? talkRatios.reduce((a, b) => a + b, 0) / talkRatios.length
      : null

    const lastCallDate = memberCalls.length > 0
      ? memberCalls.sort((a, b) =>
          new Date(b.call_date ?? 0).getTime() - new Date(a.call_date ?? 0).getTime()
        )[0].call_date
      : null

    // Determine trend: compare last 7 days vs prior 7 days
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const recentScores = memberCalls
      .filter(c => c.call_date && new Date(c.call_date) >= sevenDaysAgo)
      .map(c => c.framework_scores?.spiced_total)
      .filter((v): v is number => v !== null)

    const priorScores = memberCalls
      .filter(c => c.call_date &&
        new Date(c.call_date) >= fourteenDaysAgo &&
        new Date(c.call_date) < sevenDaysAgo)
      .map(c => c.framework_scores?.spiced_total)
      .filter((v): v is number => v !== null)

    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (recentScores.length > 0 && priorScores.length > 0) {
      const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length
      const priorAvg = priorScores.reduce((a, b) => a + b, 0) / priorScores.length
      const delta = recentAvg - priorAvg
      if (delta > 3) trend = 'up'
      else if (delta < -3) trend = 'down'
    }

    const needsCoaching = avgScore !== null && avgScore < 60

    return {
      profile: member,
      callCount: memberCalls.length,
      avgSpicedScore: avgScore ? Math.round(avgScore * 10) / 10 : null,
      avgTalkRatio: avgTalkRatio ? Math.round(avgTalkRatio * 10) / 10 : null,
      lastCallDate,
      needsCoaching,
      trend,
    }
  })
}

export function useSquadAnalytics({ profile, enabled = true }: UseSquadAnalyticsOptions) {
  return useQuery<SquadAnalyticsResult>({
    queryKey: ['gp-squad-analytics', profile?.squad, profile?.role],
    queryFn: async () => {
      const emptyResult: SquadAnalyticsResult = {
        members: [],
        memberStats: [],
        squadEmailList: [],
        topPerformer: null,
        needsCoachingList: [],
      }

      if (!profile?.squad) return emptyResult

      // Fetch squad members
      const members = await GrowthPlatformAPI.getSquadProfiles(profile.squad)
      if (members.length === 0) return emptyResult

      const squadEmailList = members.map(m => m.email)

      // Fetch last 30 days of squad calls
      const calls = await GrowthPlatformAPI.getCallsSince(30, squadEmailList)

      const memberStats = buildMemberStats(members, calls)

      // Top performer: highest average SPICED score
      const withScore = memberStats.filter(s => s.avgSpicedScore !== null)
      const topPerformer = withScore.length > 0
        ? withScore.sort((a, b) => (b.avgSpicedScore ?? 0) - (a.avgSpicedScore ?? 0))[0].profile
        : null

      const needsCoachingList = memberStats
        .filter(s => s.needsCoaching)
        .map(s => s.profile)

      return {
        members,
        memberStats,
        squadEmailList,
        topPerformer,
        needsCoachingList,
      }
    },
    enabled: enabled && !!profile && !!profile.squad,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}
