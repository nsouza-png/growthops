// ── GrowthPlatformContext — Shared state for GrowthPlatform features ──────────
// Wraps profile loading, squad resolution, and filter state in a single provider.
// Mount this inside QueryProvider, below the auth boundary.

import {
  createContext,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from 'react'
import { useGrowthPlatform } from '../hooks/useGrowthPlatform'
import { useSquadAnalytics } from '../hooks/useSquadAnalytics'
import { useRealtimeUpdates } from '../hooks/useRealtimeUpdates'
import type { GrowthPlatformProfile, GPCallFilters, GPRole } from '../types'
import { gpCanViewAll, gpCanViewSquad } from '../types'

// ── Context shape ─────────────────────────────────────────────────────────────

interface GrowthPlatformContextValue {
  // Auth / Profile
  profile: GrowthPlatformProfile | null
  profileLoading: boolean
  profileError: string | null
  // Derived role helpers
  role: GPRole | null
  canViewSquad: boolean
  canViewAll: boolean
  // Squad
  squadEmailList: string[]
  squadLoading: boolean
  // Global call filters (shared across dashboards)
  filters: GPCallFilters
  setFilters: (filters: GPCallFilters) => void
  resetFilters: () => void
  // Active timeframe for analytics
  timeframe: '7d' | '30d' | '90d'
  setTimeframe: (t: '7d' | '30d' | '90d') => void
}

const DEFAULT_FILTERS: GPCallFilters = {}

const GrowthPlatformCtx = createContext<GrowthPlatformContextValue>({
  profile: null,
  profileLoading: true,
  profileError: null,
  role: null,
  canViewSquad: false,
  canViewAll: false,
  squadEmailList: [],
  squadLoading: false,
  filters: DEFAULT_FILTERS,
  setFilters: () => {},
  resetFilters: () => {},
  timeframe: '30d',
  setTimeframe: () => {},
})

// ── Provider ──────────────────────────────────────────────────────────────────

export function GrowthPlatformProvider({ children }: { children: ReactNode }) {
  const { profile, loading: profileLoading, error: profileError } = useGrowthPlatform()

  const [filters, setFiltersState] = useState<GPCallFilters>(DEFAULT_FILTERS)
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d')

  // Squad data — coord+ (role from profile or session fallback from user_roles)
  const squadEnabled = !!profile && gpCanViewSquad(profile.role)
  const { data: squadData, isLoading: squadLoading } = useSquadAnalytics({
    profile: squadEnabled ? profile : null,
    enabled: squadEnabled,
  })

  // Real-time subscription — always active when profile is loaded
  useRealtimeUpdates({ profile, enabled: !!profile })

  const role = profile?.role ?? null
  const canViewSquad = role ? gpCanViewSquad(role) : false
  const canViewAll = role ? gpCanViewAll(role) : false
  const squadEmailList = squadData?.squadEmailList ?? []

  function setFilters(newFilters: GPCallFilters) {
    setFiltersState(newFilters)
  }

  function resetFilters() {
    setFiltersState(DEFAULT_FILTERS)
  }

  const value = useMemo<GrowthPlatformContextValue>(
    () => ({
      profile,
      profileLoading,
      profileError,
      role,
      canViewSquad,
      canViewAll,
      squadEmailList,
      squadLoading,
      filters,
      setFilters,
      resetFilters,
      timeframe,
      setTimeframe,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, profileLoading, profileError, role, canViewSquad, canViewAll,
     squadEmailList, squadLoading, filters, timeframe],
  )

  return (
    <GrowthPlatformCtx.Provider value={value}>
      {children}
    </GrowthPlatformCtx.Provider>
  )
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

export function useGrowthPlatformContext(): GrowthPlatformContextValue {
  return useContext(GrowthPlatformCtx)
}
