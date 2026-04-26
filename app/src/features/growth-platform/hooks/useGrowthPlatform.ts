// ── useGrowthPlatform — Profile management for current authenticated user ─────

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { GrowthPlatformAPI } from '../services/api'
import type { GrowthPlatformProfile } from '../types'

interface UseGrowthPlatformReturn {
  profile: GrowthPlatformProfile | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useGrowthPlatform(): UseGrowthPlatformReturn {
  const { user } = useAuth()
  const [profile, setProfile] = useState<GrowthPlatformProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // Primary: lookup by auth_user_id (populated when user has logged in before)
    let data = await GrowthPlatformAPI.getProfileByAuthId(user.id)

    // Fallback: lookup by email for profiles synced before first login
    if (!data && user.email) {
      data = await GrowthPlatformAPI.getProfileByEmail(user.email)
    }

    if (!data) {
      setError('Perfil não encontrado. Contate o administrador.')
      setProfile(null)
    } else {
      setProfile(data)
    }

    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  return { profile, loading, error, refetch: fetchProfile }
}
