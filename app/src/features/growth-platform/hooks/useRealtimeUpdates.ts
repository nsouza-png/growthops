// ── useRealtimeUpdates — Supabase realtime subscriptions for GrowthPlatform ───

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { gpSupabase } from '../../../lib/gpSupabase'
import type { GrowthPlatformProfile } from '../types'

interface UseRealtimeUpdatesOptions {
  profile: GrowthPlatformProfile | null
  enabled?: boolean
}

/**
 * Subscribes to GrowthPlatform.calls INSERT/UPDATE events.
 * On any change, invalidates the relevant React Query keys so UI refreshes.
 *
 * Executivo: watches only own seller_email.
 * Coordenador+: watches all calls visible via RLS.
 */
export function useRealtimeUpdates({ profile, enabled = true }: UseRealtimeUpdatesOptions) {
  const queryClient = useQueryClient()
  const channelRef = useRef<ReturnType<typeof gpSupabase.channel> | null>(null)

  useEffect(() => {
    if (!enabled || !profile) return

    // Build filter for executivo (reduces subscription noise)
    const callsFilter =
      profile.role === 'executivo'
        ? `seller_email=eq.${profile.email}`
        : undefined

    const channel = gpSupabase
      .channel(`gp-updates-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'GrowthPlatform',
          table: 'calls',
          ...(callsFilter ? { filter: callsFilter } : {}),
        },
        () => {
          // Invalidate all gp-calls queries so they refetch
          queryClient.invalidateQueries({ queryKey: ['gp-calls'] })
          queryClient.invalidateQueries({ queryKey: ['gp-framework-analytics'] })
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'GrowthPlatform',
          table: 'framework_scores',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['gp-calls'] })
          queryClient.invalidateQueries({ queryKey: ['gp-framework-analytics'] })
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'GrowthPlatform',
          table: 'closer_pdis',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['gp-pdis'] })
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.debug('[GP Realtime] subscribed for', profile.email)
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn('[GP Realtime] subscription error for', profile.email)
        }
      })

    channelRef.current = channel

    return () => {
      gpSupabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [profile?.id, profile?.email, profile?.role, enabled, queryClient])
}
