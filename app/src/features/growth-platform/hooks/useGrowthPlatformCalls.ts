// ── useGrowthPlatformCalls — Role-aware calls fetcher ─────────────────────────

import { useQuery } from '@tanstack/react-query'
import { GrowthPlatformAPI } from '../services/api'
import { gpCanViewAll } from '../types'
import type { GrowthPlatformCall, GrowthPlatformProfile, GPCallFilters } from '../types'

interface UseGrowthPlatformCallsOptions {
  profile: GrowthPlatformProfile | null
  squadEmails?: string[]      // pre-fetched squad emails (passed by context for coord)
  filters?: GPCallFilters
  enabled?: boolean
}

export function useGrowthPlatformCalls({
  profile,
  squadEmails,
  filters = {},
  enabled = true,
}: UseGrowthPlatformCallsOptions) {
  return useQuery<GrowthPlatformCall[]>({
    queryKey: ['gp-calls', profile?.id, profile?.role, squadEmails, filters],
    queryFn: async () => {
      if (!profile) return []

      const resolvedFilters: GPCallFilters = { ...filters }

      if (profile.role === 'executivo') {
        // See only own calls — RLS enforces this but explicit filter is faster
        resolvedFilters.seller = profile.email
      } else if (profile.role === 'coordenador') {
        // See squad calls — use pre-fetched squad emails or fall back to own
        if (squadEmails && squadEmails.length > 0) {
          resolvedFilters.sellerEmails = squadEmails
        } else {
          resolvedFilters.seller = profile.email
        }
      }
      // gerente | diretor | sales_ops | admin → RLS shows all, no extra filter

      return GrowthPlatformAPI.getCalls(resolvedFilters)
    },
    enabled: enabled && !!profile,
    staleTime: 2 * 60 * 1000,   // 2 minutes
    gcTime: 10 * 60 * 1000,
  })
}

// ── Single call detail ────────────────────────────────────────────────────────

export function useGrowthPlatformCall(callId: string | null) {
  return useQuery<GrowthPlatformCall | null>({
    queryKey: ['gp-call', callId],
    queryFn: () => GrowthPlatformAPI.getCallById(callId!),
    enabled: !!callId,
    staleTime: 5 * 60 * 1000,
  })
}

// ── Recent calls (last N days) ────────────────────────────────────────────────

export function useRecentGPCalls(
  profile: GrowthPlatformProfile | null,
  daysAgo = 30,
  squadEmails?: string[],
) {
  const since = new Date()
  since.setDate(since.getDate() - daysAgo)

  return useGrowthPlatformCalls({
    profile,
    squadEmails,
    filters: {
      dateRange: [since.toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)],
    },
  })
}

// ── Exported type helpers ─────────────────────────────────────────────────────

export { gpCanViewAll }
